import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getTutorialProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const fetchWithRetry = async (attempt = 1): Promise<string[]> => {
      console.log(`[tutorial_progress] Admin Tunnel Access (Attempt ${attempt})...`);
      
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Stage 0: If it's a retry, try to force a schema refresh first
      if (attempt > 1) {
        try {
          await supabaseAdmin.rpc("force_refresh_schema_permissions");
          // Tactical wait for cache propagation
          await new Promise(r => setTimeout(r, 800 * attempt));
        } catch (e) {
          console.warn("[tutorial_progress] Refresh RPC failed during retry:", e);
        }
      }

      const { data, error } = await supabaseAdmin
        .from("tutorial_progress")
        .select("tutorial_id")
        .eq("user_id", userId);

      if (error) {
        console.error(`[tutorial_progress] Admin Tunnel Error (Attempt ${attempt}):`, error);
        
        const isSchemaError = error.code === 'PGRST108' || 
                             error.message?.includes("schema cache") || 
                             error.message?.includes("does not exist") ||
                             error.code === '42P01';
        
        if (isSchemaError && attempt <= 3) {
          return fetchWithRetry(attempt + 1);
        }
        
        // Final failure handling
        if (isSchemaError) {
          const wrapped = new Error(`Falha de Sincronização Crítica: ${error.message}`);
          (wrapped as any)._schemaError = "public.tutorial_progress";
          throw wrapped;
        }
        throw new Error(`Erro de Banco: ${error.message}`);
      }
      
      const results = (data ?? []).map((p: any) => p.tutorial_id);
      console.log(`[tutorial_progress] Admin Tunnel SUCCESS: ${results.length} items.`);
      return results;
    };

    return await fetchWithRetry();
  });

export const toggleTutorialStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ tutorialId: z.string(), completed: z.boolean() }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.completed) {
      const { error } = await supabase
        .from("tutorial_progress")
        .upsert({ user_id: userId, tutorial_id: data.tutorialId });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("tutorial_progress")
        .delete()
        .eq("user_id", userId)
        .eq("tutorial_id", data.tutorialId);
      if (error) throw new Error(error.message);
    }

    return { success: true };
  });
