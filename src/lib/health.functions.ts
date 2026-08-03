import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const performHealthCheck = createServerFn({ method: "POST" })
  .handler(async ({ context }) => {
    const results = {
      database: { status: "healthy" as "healthy" | "degraded" | "critical", message: "Connectado" },
      tables: {
        support_threads: { accessible: false },
        support_messages: { accessible: false },
        apk_build_jobs: { accessible: false },
        trials: { accessible: false },
      },
      timestamp: new Date().toISOString(),
    };

    try {
      // Test basic connectivity and table permissions for service_role
      const [threads, messages, apks, trials] = await Promise.all([
        supabaseAdmin.from("support_threads").select("id").limit(1),
        supabaseAdmin.from("support_messages").select("id").limit(1),
        supabaseAdmin.from("apk_build_jobs").select("id").limit(1),
        supabaseAdmin.from("trials").select("id").limit(1),
      ]);

      results.tables.support_threads.accessible = !threads.error;
      results.tables.support_messages.accessible = !messages.error;
      results.tables.apk_build_jobs.accessible = !apks.error;
      results.tables.trials.accessible = !trials.error;

      if (threads.error || messages.error || apks.error || trials.error) {
        results.database.status = "degraded";
        results.database.message = "Algumas tabelas estão inacessíveis (Service Role)";
      }
    } catch (e: any) {
      results.database.status = "critical";
      results.database.message = e.message || "Falha crítica no banco de dados";
    }

    return results;
  });
