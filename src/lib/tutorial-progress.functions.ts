import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getTutorialProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { userId, supabase } = context;

    const fetchWithRetry = async (attempt = 1): Promise<string[]> => {
      console.log(`[tutorial_progress] Admin Tunnel (Attempt ${attempt})...`);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      
      const { data, error } = await supabaseAdmin
        .from("tutorial_progress")
        .select("tutorial_id")
        .eq("user_id", userId);

      if (error) {
        console.error(`[tutorial_progress] Client Error (Attempt ${attempt}):`, error);
        
        const isSchemaError = error.code === 'PGRST108' || 
                             error.message?.includes("schema cache") || 
                             error.message?.includes("does not exist") ||
                             error.code === '42P01';
        
        if (isSchemaError && attempt <= 3) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.rpc("force_refresh_schema_permissions");
          await new Promise(r => setTimeout(r, 800 * attempt));
          return fetchWithRetry(attempt + 1);
        }
        
        throw new Error(`Erro de Banco: ${error.message}`);
      }
      
      const results = (data ?? []).map((p: any) => p.tutorial_id);
      console.log(`[tutorial_progress] Client SUCCESS: ${results.length} items.`);
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
    const { userId, supabase } = context;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.completed) {
      const { error } = await supabaseAdmin
        .from("tutorial_progress")
        .upsert({ user_id: userId, tutorial_id: data.tutorialId }, { onConflict: "user_id,tutorial_id" });
      if (error) {
        console.error("[tutorial_progress] Upsert failure via Client:", error);
        throw new Error(error.message);
      }
    } else {
      const { error } = await supabaseAdmin
        .from("tutorial_progress")
        .delete()
        .eq("user_id", userId)
        .eq("tutorial_id", data.tutorialId);
      if (error) {
        console.error("[tutorial_progress] Delete failure via Client:", error);
        throw new Error(error.message);
      }
    }

    return { success: true };
  });
