import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getTutorialProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const fetchWithRetry = async (attempt = 1): Promise<string[]> => {
      console.log(`[tutorial_progress] Busca tática de progresso (Tentativa ${attempt})...`);
      
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data, error } = await supabaseAdmin
        .from("tutorial_progress")
        .select("tutorial_id")
        .eq("user_id", userId);

      if (error) {
        console.error(`[tutorial_progress] Erro no Admin Tunnel (Tentativa ${attempt}):`, error);
        
        const isSchemaError = error.message?.includes("schema cache") || 
                             error.message?.includes("does not exist") ||
                             error.code === 'PGRST108' ||
                             error.code === '42P01';
        
        if (isSchemaError && attempt <= 3) {
          console.warn("[tutorial_progress] Falha de schema detectada. Acionando reparo tático...");
          try {
            await supabaseAdmin.rpc("force_refresh_schema_permissions");
            // Toque tático na tabela
            await supabaseAdmin.from("tutorial_progress").select("*", { count: 'exact', head: true }).limit(1);
            await new Promise(r => setTimeout(r, 1000 * attempt));
            return fetchWithRetry(attempt + 1);
          } catch (e) {
            console.error("[tutorial_progress] Routine de reparo falhou:", e);
          }
        }
        
        if (isSchemaError) {
          const wrapped = new Error(`Erro de Sincronização (Progresso): ${error.message}`);
          (wrapped as any)._schemaError = "public.tutorial_progress";
          throw wrapped;
        }
        throw new Error(`Erro no Progresso: ${error.message}`);
      }
      
      const results = (data ?? []).map((p: any) => p.tutorial_id);
      console.log(`[tutorial_progress] Admin Tunnel retornou ${results.length} itens de progresso.`);
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
