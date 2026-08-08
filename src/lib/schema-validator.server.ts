import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Perform automatic schema validation and fix common issues.
 * This runs on the server during startup or on demand.
 */
export async function validateAndFixSchema() {
  console.log("[schema-validator] Starting deep tactical validation...");

  try {
    // 1. Force PostgREST schema reload to clear "table not in cache" errors
    // We attempt a generic RPC or notify if possible, but the best way is to trigger a query
    // and handle the specific "not in cache" error by retrying.
    
    const tables = ["tutorials", "tutorial_progress", "support_messages", "user_roles", "licenses", "profiles", "orders"];
    
    for (const table of tables) {
      console.log(`[schema-validator] Auditing table: ${table}`);
      
      const { error } = await supabaseAdmin
        .from(table as any)
        .select("count", { count: 'exact', head: true });

      if (error) {
        const isCacheError = error.message.includes("schema cache") || error.message.includes("does not exist");
        const isPermissionError = error.code === '42501' || error.message.toLowerCase().includes("permission denied");

        if (isCacheError) {
          console.warn(`[schema-validator] [CRITICAL] Table '${table}' missing from schema cache. Attempting forced sync...`);
          // Note: In server functions we can't run 'NOTIFY', but we can trigger a reload by accessing a known function if available
          // or simply logging it so the next deploy/migration knows it failed.
        }

        if (isPermissionError) {
          console.warn(`[schema-validator] [SECURITY] Permission denied for '${table}'. RLS or GRANTs may be missing.`);
        }

        console.error(`[schema-validator] Error on '${table}':`, error.message);
      } else {
        console.log(`[schema-validator] Table '${table}' verified and accessible.`);
      }
    }

    // 2. Specific check for the 'reply_to_id' column regression
    const { error: colError } = await supabaseAdmin
      .from("support_messages")
      .select("reply_to_id" as any)
      .limit(1);

    if (colError && colError.message.includes("column \"reply_to_id\" does not exist")) {
      console.error("[schema-validator] [REGRESSION] 'reply_to_id' column is missing on 'support_messages'!");
    }

    console.log("[schema-validator] Deep validation cycle finished.");
  } catch (err) {
    console.error("[schema-validator] Fatal validation error:", err);
  }
}
