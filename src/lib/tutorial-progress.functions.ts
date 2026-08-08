import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getTutorialProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { supabase, userId } = context;

    const { data, error } = await supabase
      .from("tutorial_progress")
      .select("tutorial_id")
      .eq("user_id", userId);

    if (error) {
      console.error("[tutorial_progress] Fetch FAILED:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      const isSchemaError = error.message?.includes("schema cache") || 
                           error.message?.includes("does not exist") ||
                           error.code === 'PGRST108' ||
                           error.code === '42P01';
      
      if (isSchemaError) {
        console.warn("[tutorial_progress] Schema cache issue detected. Attempting recovery...");
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.rpc("force_refresh_schema_permissions");
          await new Promise(r => setTimeout(r, 500));
          
          const { data: retryData, error: retryError } = await supabase
            .from("tutorial_progress")
            .select("tutorial_id")
            .eq("user_id", userId);
            
          if (!retryError) {
            console.log("[tutorial_progress] Recovery SUCCESSFUL");
            return (retryData ?? []).map((p: any) => p.tutorial_id);
          }
        } catch (e) {
          console.error("[tutorial_progress] Recovery routine failed:", e);
        }
        
        const wrapped = new Error(`Erro de Sincronização (Progresso): ${error.message}`);
        (wrapped as any)._schemaError = "public.tutorial_progress";
        throw wrapped;
      }
      throw new Error(`Erro no Progresso: ${error.message}`);
    }
    return (data ?? []).map((p: any) => p.tutorial_id);
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
