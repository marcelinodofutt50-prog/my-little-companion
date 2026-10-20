// Cron: reativa sozinho os logins pausados cuja data de retorno chegou.
// Protegido pelo segredo de cron (servidor), igual aos demais hooks.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/resume-paused-licenses")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronUnauthorized } = await import("@/lib/cron-auth.server");
        const denied = cronUnauthorized(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { resumeLicenseCore } = await import("@/lib/license-pause.server");
        const { data: due, error } = await supabaseAdmin
          .from("licenses")
          .select("*")
          .not("suspended_at", "is", null)
          .not("pause_until" as any, "is", null)
          .lte("pause_until" as any, new Date().toISOString())
          .is("disabled_at", null)
          .limit(100);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        let resumed = 0;
        const failed: string[] = [];
        for (const lic of due ?? []) {
          try {
            await resumeLicenseCore(lic, { by: "auto", actorId: null });
            resumed++;
          } catch (e: any) {
            failed.push(lic.id);
            await supabaseAdmin.from("integration_logs").insert({
              source: "auto-resume", action: "license_resume", outcome: "error",
              error: String(e?.message ?? e).slice(0, 500),
              context: { license_id: lic.id } as any,
            } as any);
          }
        }
        return Response.json({ ok: true, due: due?.length ?? 0, resumed, failed: failed.length });
      },
    },
  },
});
