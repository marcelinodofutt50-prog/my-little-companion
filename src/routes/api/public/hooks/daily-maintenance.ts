import { createFileRoute } from "@tanstack/react-router";

/**
 * Orquestrador diário de manutenção.
 *
 * A conta Vercel (Hobby) permite apenas UM cron diário, então em vez de deixar
 * os demais hooks sem execução, este endpoint dispara todos em sequência,
 * reutilizando o mesmo segredo de cron. Cada hook continua acessível
 * individualmente (para acionamento manual / futuro plano Pro).
 */
const TASKS = [
  "reconcile-pending",
  "verify-external-payers",
  "expire-licenses",
  "daily-license-check",
  "reconcile-yaarsa",
  "resend-confirmations",
  "auto-close-tickets",
  "cleanup-apk-jobs",
] as const;

async function runDailyMaintenance(request: Request) {
  const { cronUnauthorized } = await import("@/lib/cron-auth.server");
  const denied = cronUnauthorized(request);
  if (denied) return denied;

  const secret = (process.env.CRON_SECRET ?? process.env.CRON_TRIGGER_TOKEN ?? "").trim();
  const origin = new URL(request.url).origin;
  const started = Date.now();

  const results: { task: string; status: number | "error"; ms: number; detail?: string }[] = [];

  for (const task of TASKS) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${origin}/api/public/hooks/${task}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
          "x-cron-origin": "daily-maintenance",
        },
      });
      const text = await res.text();
      results.push({
        task,
        status: res.status,
        ms: Date.now() - t0,
        detail: res.ok ? undefined : text.slice(0, 300),
      });
    } catch (e) {
      results.push({
        task,
        status: "error",
        ms: Date.now() - t0,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const failed = results.filter((r) => r.status === "error" || (typeof r.status === "number" && r.status >= 400));

  // Telemetria best-effort: nunca derruba o cron.
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Colunas reais da tabela: source/action/outcome/context.
    await supabaseAdmin.from("integration_logs").insert({
      source: "cron",
      action: "daily-maintenance",
      outcome: failed.length ? "partial" : "success",
      error: failed.length ? failed.map((f) => `${f.task}:${f.status}`).join(", ") : null,
      context: { results, totalMs: Date.now() - started },
    } as never);
  } catch {
    // tabela opcional
  }

  return new Response(
    JSON.stringify({ ok: failed.length === 0, totalMs: Date.now() - started, results }),
    { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
}

export const Route = createFileRoute("/api/public/hooks/daily-maintenance")({
  server: {
    handlers: {
      GET: async ({ request }) => runDailyMaintenance(request),
      POST: async ({ request }) => runDailyMaintenance(request),
    },
  },
});
