// Cron: enforcement da cadência de creator (1 vídeo aprovado a cada 14 dias).
// Vencido -> perde cargo + licença de creator (banco + painel). Veja a lógica em
// creator-cadence.server.ts.
//
// SEGURO POR PADRÃO: roda em dry-run (só loga 'would_lapse') até o ambiente ter
// CREATOR_CADENCE_ENFORCE=on. Assim dá pra observar um ciclo antes de cortar.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/enforce-creator-cadence")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronUnauthorized } = await import("@/lib/cron-auth.server");
        const denied = cronUnauthorized(request);
        if (denied) return denied;

        const { acquireOpLock, releaseOpLock } = await import("@/lib/audit-trail.server");
        const LOCK = "cron:enforce-creator-cadence";
        if (!(await acquireOpLock(LOCK, 300, "enforce-creator-cadence"))) {
          return Response.json({ ok: true, skipped: "already_running" });
        }
        try {
          const enforce = (process.env.CREATOR_CADENCE_ENFORCE ?? "").trim().toLowerCase() === "on";
          const { enforceCreatorCadence } = await import("@/lib/creator-cadence.server");
          const result = await enforceCreatorCadence({ dryRun: !enforce });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("integration_logs").insert({
            source: "creator-cadence", action: "cron", outcome: "error",
            error: e instanceof Error ? e.message : String(e),
          } as any);
          return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500 });
        } finally {
          await releaseOpLock(LOCK);
        }
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
