import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const testDatabaseConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const start = Date.now();
    try {
      // Test 1: Basic connection & schema cache
      // We also try to touch the relation directly here to see if it triggers an error
      const { data, error, status } = await context.supabase
        .from("tutorials")
        .select("id")
        .limit(1);

      const latency = Date.now() - start;

      if (error) {
        // If error is PGRST108, attempt a repair via RPC before returning
        if (error.code === 'PGRST108' || error.message?.includes('schema cache')) {
           const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
           if (supabaseAdmin) {
              await supabaseAdmin.rpc("force_refresh_schema_permissions");
           }
        }
        
        return {
          success: false,
          latency,
          status,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        latency,
        status,
        rowCount: data?.length ?? 0,
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      return {
        success: false,
        latency: Date.now() - start,
        error: err.message || "Unknown error",
        timestamp: new Date().toISOString()
      };
    }
  });
