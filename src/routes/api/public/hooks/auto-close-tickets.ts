import { createFileRoute } from "@tanstack/react-router";

/**
 * Fecha atendimentos após cinco horas sem atividade e sem pendências de
 * pagamento ou entrega.
 *
 * Auth: Bearer CRON_TRIGGER_TOKEN.
 */

export const Route = createFileRoute("/api/public/hooks/auto-close-tickets")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronUnauthorized } = await import("@/lib/cron-auth.server");
        const denied = cronUnauthorized(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runSupportAutoClose } = await import("@/lib/support-auto-close.server");
        let stats;
        try { stats = await runSupportAutoClose(supabaseAdmin); }
        catch {
          return Response.json({ error: "Não foi possível verificar os atendimentos." }, { status: 500 });
        }

        await supabaseAdmin.from("integration_logs").insert({
          source: "support", action: "auto-close-tickets", outcome: stats.readFailures || stats.noticeFailures ? "partial" : "success",
          context: stats,
        } as never).then(() => undefined, () => undefined);

        return new Response(JSON.stringify(stats), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
      GET: async () => new Response("Use POST", { status: 405, headers: { Allow: "POST" } }),
    },
  },
});
