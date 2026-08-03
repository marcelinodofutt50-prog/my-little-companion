import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Perform automatic schema validation and fix common issues.
 * This runs on the server during startup or on demand.
 */
export async function validateAndFixSchema() {
  console.log("[schema-validator] Starting validation...");

  try {
    // 1. Check for reply_to_id on support_messages
    // We use a query that will fail if the column is missing
    const { error: colError } = await supabaseAdmin
      .from("support_messages")
      .select("reply_to_id" as any)
      .limit(1);

    if (colError && colError.message.includes("column \"reply_to_id\" does not exist")) {
      console.info("[schema-validator] Column 'reply_to_id' missing on 'support_messages'.");
      // Since exec_sql RPC isn't available/typed, we log and expect the migration tool or next user message to handle DDL
      // In a real environment, we'd trigger a migration script or alert the admin
      console.warn("[schema-validator] ACTION REQUIRED: Run migration to add 'reply_to_id' to 'support_messages'");
    }

    // 2. Health check of critical tables
    const tables = ["support_messages", "support_threads", "apk_jobs"];
    for (const table of tables) {
      const { error } = await supabaseAdmin.from(table as any).select("id" as any).limit(1);
      if (error) {
        console.error(`[schema-validator] Table '${table}' health check failed:`, error.message);
      } else {
        console.log(`[schema-validator] Table '${table}' is healthy.`);
      }
    }

    console.log("[schema-validator] Validation complete.");
  } catch (err) {
    console.error("[schema-validator] Unexpected error:", err);
  }
}
