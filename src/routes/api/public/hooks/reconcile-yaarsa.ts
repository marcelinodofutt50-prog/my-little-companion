/**
 * Conferência painel Yaarsa ↔ site.
 *
 * Roda junto da manutenção diária: procura licenças ativas no site cuja conta
 * sumiu do painel e recria automaticamente com a mesma senha e validade.
 *
 * Auth: Bearer CRON_SECRET / CRON_TRIGGER_TOKEN (ou header x-cron-secret).
 */
import { createFileRoute } from "@tanstack/react-router";

async function run(request: Request) {
  const { cronUnauthorized } = await import("@/lib/cron-auth.server");
  const denied = cronUnauthorized(request);
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 60);
    const { auditPanelIntegrity } = await import("@/lib/panel-integrity.server");
    const report = await auditPanelIntegrity({ limit, autoRepair: true });
    return Response.json({ ok: true, ...report, rows: report.rows.filter((r) => r.status !== "ok") });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/public/hooks/reconcile-yaarsa")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});
