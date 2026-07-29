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
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (token !== process.env.CRON_TRIGGER_TOKEN) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }

        const { createClient } = await import("@supabase/supabase-js");
        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient(process.env.SUPABASE_URL!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const { data, error } = await supabase.rpc("expire_stale_apk_jobs");
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ expired: data ?? 0 }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
