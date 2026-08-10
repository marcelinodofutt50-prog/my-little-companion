import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Shadow Reporting Engine (v11.1)
 * Gera relatórios automáticos de falhas críticas de infraestrutura e testes.
 */

export const generateDiagnosticReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({
    testName: z.string(),
    error: z.any(),
    stack: z.string().optional(),
    payload: z.any().optional(),
    context: z.string().optional()
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const timestamp = new Date().toISOString();

    console.error(`[Shadow Report] Falha detectada em "${data.testName}":`, data.error);

    // 1. Coletar estado do banco para auditoria
    const [threadsCount, messagesCount, bucketStatus] = await Promise.all([
      supabaseAdmin.from('support_threads').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('support_messages').select('id', { count: 'exact', head: true }),
      supabaseAdmin.storage.getBucket('support-media')
    ]);

    const dbState = {
      threads_count: threadsCount.count || 0,
      messages_count: messagesCount.count || 0,
      bucket_exists: !bucketStatus.error,
      db_error: threadsCount.error?.message || null
    };

    // 2. Persistir no log de integração forense
    const logPayload = {
      source: "support-e2e-report",
      user_id: userId,
      action: "test_failure_report",
      outcome: "critical",
      error: typeof data.error === 'string' ? data.error : (data.error?.message || "Unknown error"),
      context: {
        test_name: data.testName,
        stack_trace: data.stack || "No stack provided",
        request_payload: data.payload || {},
        database_snapshot: dbState,
        browser_context: data.context || "N/A",
        timestamp
      }
    };

    const { error: logError } = await supabaseAdmin.from("integration_logs").insert(logPayload);

    if (logError) {
      console.error("[Shadow Report] Falha ao persistir relatório no banco:", logError);
    }

    return { 
      reportId: timestamp,
      status: logError ? "logged_to_console_only" : "persisted",
      dbSnapshot: dbState
    };
  });
