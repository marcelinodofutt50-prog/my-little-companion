import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EmailEventOutcome = "sent" | "failed" | "rate_limited" | "blocked_local";

export type EmailEventInput = {
  /** signup | resend | recovery | magic_link */
  action: string;
  outcome: EmailEventOutcome;
  /** e-mail do destinatário (armazenado mascarado) */
  email?: string;
  /** mensagem crua do provedor (sem PII) */
  error?: string;
  /** segundos de espera informados pelo provedor no 429 */
  retryAfter?: number;
  httpStatus?: number;
};

function maskEmail(email?: string) {
  if (!email) return null;
  const [user, domain] = email.split("@");
  if (!domain) return null;
  const head = user.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

/**
 * Registra uma tentativa de envio de e-mail de autenticação em integration_logs.
 * Público de propósito: o fluxo de cadastro/login acontece antes de haver sessão.
 * Não grava e-mail em claro, apenas versão mascarada.
 */
export const logEmailEvent = createServerFn({ method: "POST" })
  .inputValidator((input: EmailEventInput) => input)
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("integration_logs").insert({
        source: "auth_email",
        action: String(data.action ?? "unknown").slice(0, 64),
        endpoint_kind: "supabase_auth",
        outcome: data.outcome,
        http_status: data.httpStatus ?? (data.outcome === "rate_limited" ? 429 : null),
        error: data.error ? String(data.error).slice(0, 500) : null,
        context: {
          recipient_masked: maskEmail(data.email),
          retry_after_seconds: data.retryAfter ?? null,
        },
      });
    } catch {
      // logging nunca pode quebrar o fluxo de cadastro
    }
    return { ok: true };
  });

export type EmailMetrics = {
  windowHours: number;
  total: number;
  sent: number;
  failed: number;
  rateLimited: number;
  blockedLocal: number;
  successRate: number;
  lastRateLimitAt: string | null;
  byAction: { action: string; sent: number; failed: number; rateLimited: number }[];
  recent: {
    at: string;
    action: string;
    outcome: string;
    recipient: string | null;
    error: string | null;
  }[];
};

/** Métricas agregadas de envio de e-mails (somente admin). */
export const getEmailMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { hours?: number } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const hours = Math.min(Math.max(Number(data.hours ?? 24), 1), 168);
    const since = new Date(Date.now() - hours * 3600_000).toISOString();

    const { data: rows, error } = await context.supabase
      .from("integration_logs")
      .select("created_at, action, outcome, error, context")
      .eq("source", "auth_email")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const count = (o: string) => list.filter((r: any) => r.outcome === o).length;
    const sent = count("sent");
    const failed = count("failed");
    const rateLimited = count("rate_limited");
    const blockedLocal = count("blocked_local");

    const actions = Array.from(new Set(list.map((r: any) => r.action ?? "unknown")));
    const byAction = actions.map((a) => {
      const sub = list.filter((r: any) => (r.action ?? "unknown") === a);
      return {
        action: a as string,
        sent: sub.filter((r: any) => r.outcome === "sent").length,
        failed: sub.filter((r: any) => r.outcome === "failed").length,
        rateLimited: sub.filter((r: any) => r.outcome === "rate_limited").length,
      };
    });

    const metrics: EmailMetrics = {
      windowHours: hours,
      total: list.length,
      sent,
      failed,
      rateLimited,
      blockedLocal,
      successRate: list.length ? Math.round((sent / list.length) * 100) : 100,
      lastRateLimitAt:
        list.find((r: any) => r.outcome === "rate_limited")?.created_at ?? null,
      byAction,
      recent: list.slice(0, 25).map((r: any) => ({
        at: r.created_at,
        action: r.action ?? "unknown",
        outcome: r.outcome ?? "unknown",
        recipient: r.context?.recipient_masked ?? null,
        error: r.error ?? null,
      })),
    };
    return metrics;
  });
