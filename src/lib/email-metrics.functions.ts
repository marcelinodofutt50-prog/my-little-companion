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

export type TestEmailResult = {
  ok: boolean;
  recipientMasked: string | null;
  latencyMs: number;
  httpStatus: number | null;
  retryAfter: number | null;
  senderDomain: string;
  senderVerified: boolean;
  message: string;
  at: string;
};

/**
 * Dispara um e-mail real de teste (recovery) para diagnosticar entrega/rate limit.
 * Somente admin. Nunca cria usuários novos.
 */
export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw new Error("E-mail inválido");
    }
    return { email };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const senderDomain = process.env.EMAIL_SENDER_DOMAIN ?? "shadowdashstore.com";
    const senderVerified = Boolean(process.env.EMAIL_SENDER_DOMAIN);

    const started = Date.now();
    let httpStatus: number | null = null;
    let retryAfter: number | null = null;
    let ok = false;
    let message = "";

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email);
      if (error) {
        httpStatus = (error as any).status ?? null;
        if (httpStatus === 429) {
          const m = /(\d+)\s*second/i.exec(error.message ?? "");
          retryAfter = m ? Number(m[1]) : 60;
          message = `Rate limit do provedor (429). Aguarde ${retryAfter}s.`;
        } else {
          message = error.message ?? "Falha desconhecida no envio";
        }
      } else {
        ok = true;
        httpStatus = 200;
        message = senderVerified
          ? `E-mail aceito pelo provedor e enviado por ${senderDomain}.`
          : `E-mail aceito pelo provedor, mas o domínio ${senderDomain} ainda não está verificado — o envio saiu pelo remetente padrão (cota baixa, risco de spam).`;
      }
    } catch (e: any) {
      message = e?.message ?? "Erro inesperado";
    }

    const latencyMs = Date.now() - started;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("integration_logs").insert({
        source: "auth_email",
        action: "test_send",
        endpoint_kind: "supabase_auth",
        outcome: ok ? "sent" : httpStatus === 429 ? "rate_limited" : "failed",
        http_status: httpStatus,
        error: ok ? null : message.slice(0, 500),
        context: {
          recipient_masked: maskEmail(data.email),
          retry_after_seconds: retryAfter,
          latency_ms: latencyMs,
          sender_domain: senderDomain,
          sender_verified: senderVerified,
        },
      });
    } catch {
      /* logging não pode quebrar o teste */
    }

    const result: TestEmailResult = {
      ok,
      recipientMasked: maskEmail(data.email),
      latencyMs,
      httpStatus,
      retryAfter,
      senderDomain,
      senderVerified,
      message,
      at: new Date().toISOString(),
    };
    return result;
  });
