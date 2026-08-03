import { createServerFn } from "@tanstack/react-start";

export const performHealthCheck = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results = {
      database: { status: "healthy" as "healthy" | "degraded" | "critical", message: "Conectado" },
      tables: {
        support_threads: { accessible: false },
        support_messages: { accessible: false },
        apk_build_jobs: { accessible: false },
        trials: { accessible: false },
      },
      timestamp: new Date().toISOString(),
      schema: { reply_to_id: false }
    };

    try {
      const { error: schemaError } = await supabaseAdmin
        .from("support_messages")
        .select("reply_to_id")
        .limit(1);

      results.schema.reply_to_id = !schemaError;

      if (schemaError && schemaError.message.includes("reply_to_id")) {
        const { validateAndFixSchema } = await import("./schema-validator.server");
        validateAndFixSchema();
      }

      // Use head+count so we don't depend on any specific column (trials has no `id`)
      const [threads, messages, apks, trials] = await Promise.all([
        supabaseAdmin.from("support_threads").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("support_messages").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("apk_build_jobs").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("trials").select("*", { count: "exact", head: true }),
      ]);

      results.tables.support_threads.accessible = !threads.error;
      results.tables.support_messages.accessible = !messages.error;
      results.tables.apk_build_jobs.accessible = !apks.error;
      results.tables.trials.accessible = !trials.error;

      const failed = [
        threads.error && `support_threads: ${threads.error.message}`,
        messages.error && `support_messages: ${messages.error.message}`,
        apks.error && `apk_build_jobs: ${apks.error.message}`,
        trials.error && `trials: ${trials.error.message}`,
      ].filter(Boolean);

      if (failed.length > 0) {
        results.database.status = "degraded";
        results.database.message = `Tabelas inacessíveis: ${failed.join(" | ")}`;
      }
    } catch (e: any) {
      results.database.status = "critical";
      results.database.message = e.message || "Falha crítica no banco de dados";
    }

    return results;
  });

