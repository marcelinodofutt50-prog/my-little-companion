import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron-safe cleanup of stuck APK jobs.
 * Calls the existing expire_stale_apk_jobs() SQL function to release jobs
 * that have been claimed/processing for too long.
 *
 * Auth: Bearer CRON_TRIGGER_TOKEN.
 */
export const Route = createFileRoute("/api/public/hooks/cleanup-apk-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronUnauthorized } = await import("@/lib/cron-auth.server");
        const denied = cronUnauthorized(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("expire_stale_apk_jobs");
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        // Descarte dos arquivos vencidos (APK original e assinado). Falhar aqui
        // não pode derrubar a liberação dos jobs travados acima.
        let purged = 0;
        let purgeError: string | null = null;
        try {
          const { purgeExpiredApkJobs } = await import("@/lib/apk-retention.server");
          const res = await purgeExpiredApkJobs(supabaseAdmin);
          purged = res.purged;
        } catch (e: any) {
          purgeError = e?.message ?? String(e);
          console.error("[cleanup-apk-jobs] purge falhou:", e);
        }

        return new Response(JSON.stringify({ expired: data ?? 0, purged, purgeError }), {
          headers: { "Content-Type": "application/json" },
        });

      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
