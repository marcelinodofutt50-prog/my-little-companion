import { createFileRoute } from "@tanstack/react-router";

/**
 * Fecha as ondas de migração vencidas e revoga os logins antigos que ficaram
 * para trás. O prazo é decidido AQUI (servidor), nunca no navegador.
 *
 * Auth: Bearer CRON_TRIGGER_TOKEN.
 */
export const Route = createFileRoute("/api/public/hooks/migration-wave-enforce")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronUnauthorized } = await import("@/lib/cron-auth.server");
        const denied = cronUnauthorized(request);
        if (denied) return denied;

        try {
          const { enforceExpiredWaves } = await import("@/lib/migration-wave.server");
          const result = await enforceExpiredWaves();
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("integration_logs").insert({
            source: "migration", action: "migration-wave-enforce", outcome: "success", context: result,
          } as never).then(() => undefined, () => undefined);
          return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e?.message ?? "erro" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
