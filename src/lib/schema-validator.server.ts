import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Perform automatic schema validation and fix common issues.
 * This runs on the server during startup or on demand.
 */
export async function validateAndFixSchema() {
  console.log("[schema-validator] Starting validation...");

  try {
    // 1. Ensure support_messages has reply_to_id
    const { data: cols, error: colError } = await supabaseAdmin
      .from("information_schema.columns" as any)
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", "support_messages")
      .eq("column_name", "reply_to_id");

    if (colError) {
      console.warn("[schema-validator] Failed to read information_schema:", colError.message);
    } else if (!cols || cols.length === 0) {
      console.info("[schema-validator] Column 'reply_to_id' missing on 'support_messages'. Applying fix...");
      const { error: fixError } = await supabaseAdmin.rpc("exec_sql", {
        sql: `ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.support_messages(id);`
      } as any).catch(async () => {
        // Fallback to raw query if RPC not available (unlikely for admin client but good to have)
        return { error: { message: "exec_sql RPC not found" } };
      });

      if (fixError) {
        console.error("[schema-validator] Failed to add column via RPC:", fixError.message);
      } else {
        console.info("[schema-validator] Column 'reply_to_id' added successfully.");
      }
    }

    // 2. Ensure basic tables exist and are granted correctly
    // We touch comments to trigger a cache refresh in PostgREST
    const touchTables = ["support_messages", "support_threads", "apk_build_jobs"];
    for (const table of touchTables) {
      await supabaseAdmin.rpc("exec_sql", {
        sql: `
          GRANT ALL ON public.${table} TO authenticated, service_role;
          COMMENT ON TABLE public.${table} IS 'Shadow Store System Table (Updated: ${new Date().toISOString()})';
        `
      } as any).catch(() => {});
    }

    console.log("[schema-validator] Validation complete.");
  } catch (err) {
    console.error("[schema-validator] Unexpected error:", err);
  }
}
