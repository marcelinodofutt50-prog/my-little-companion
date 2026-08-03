import { createServerFn } from "@tanstack/react-start";

export type HealthFailure = {
  scope: string;
  table: string;
  query: string;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export const performHealthCheck = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const failures: HealthFailure[] = [];
    const results = {
      database: { status: "healthy" as "healthy" | "degraded" | "critical", message: "Conectado" },
      tables: {
        support_threads: { accessible: false },
        support_messages: { accessible: false },
        apk_build_jobs: { accessible: false },
        trials: { accessible: false },
      },
      timestamp: new Date().toISOString(),
      schema: { reply_to_id: false },
      failures,
    };

    const record = (scope: string, table: string, query: string, error: any) => {
      failures.push({
        scope,
        table,
        query,
        message: error?.message || "Erro desconhecido",
        code: error?.code || undefined,
        details: error?.details || undefined,
        hint: error?.hint || undefined,
      });
    };

    try {
      const schemaQuery = `supabase.from("support_messages").select("reply_to_id").limit(1)`;
      const { error: schemaError } = await supabaseAdmin
        .from("support_messages")
        .select("reply_to_id")
        .limit(1);

      results.schema.reply_to_id = !schemaError;

      if (schemaError) {
        record("Schema", "support_messages", schemaQuery, schemaError);
        if (schemaError.message.includes("reply_to_id")) {
          const { validateAndFixSchema } = await import("./schema-validator.server");
          validateAndFixSchema();
        }
      }

      // Use head+count so we don't depend on any specific column (trials has no `id`)
      const probes = [
        { scope: "Suporte", table: "support_threads" as const },
        { scope: "Suporte", table: "support_messages" as const },
        { scope: "Play Protect", table: "apk_build_jobs" as const },
        { scope: "Trials", table: "trials" as const },
      ];

      const responses = await Promise.all(
        probes.map((p) => supabaseAdmin.from(p.table).select("*", { count: "exact", head: true })),
      );

      probes.forEach((p, i) => {
        const res = responses[i]!;
        results.tables[p.table].accessible = !res.error;
        if (res.error) {
          record(
            p.scope,
            p.table,
            `supabase.from("${p.table}").select("*", { count: "exact", head: true })`,
            res.error,
          );
        }
      });

      if (failures.length > 0) {
        results.database.status = "degraded";
        results.database.message = `Falhas em: ${failures.map((f) => f.table).join(", ")}`;
      }
    } catch (e: any) {
      results.database.status = "critical";
      results.database.message = e?.message || "Falha crítica no banco de dados";
      record("Database", "—", "performHealthCheck()", e);
    }

    return results;
  });
