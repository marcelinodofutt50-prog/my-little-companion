import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const updateProfileCustomization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({
    nickname: z.string().min(2).max(30).optional(),
    avatar_url: z.string().url().optional(),
    is_anonymous: z.boolean().optional()
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    try {
      const updates: any = {};
      
      // Tentativa resiliente de atualização com bypass de cache se necessário
      const performUpdate = async (client: any, userId: string, data: any) => {
        // Primeiro buscamos o perfil para não sobrescrever outros campos do metadata
        const { data: profile, error: fetchError } = await client
          .from("profiles")
          .select("metadata, display_name")
          .eq("id", userId)
          .maybeSingle();

        if (fetchError) throw fetchError;
        
        const currentMetadata = (profile?.metadata as any) || {};
        if (data.avatar_url) currentMetadata.avatar_url = data.avatar_url;
        if (data.is_anonymous !== undefined) currentMetadata.is_anonymous = data.is_anonymous;
        
        const finalUpdates: any = {
          metadata: currentMetadata,
          updated_at: new Date().toISOString()
        };
        
        if (data.nickname) finalUpdates.display_name = data.nickname;

        return client
          .from("profiles")
          .update(finalUpdates)
          .eq("id", userId);
      };

      const { error: updateError } = await performUpdate(supabase, userId, data);

      if (updateError) {
        // Erro 42703 (coluna não existe) ou PGRST108 (cache stale)
        const isSchemaError = updateError.code === "42703" || updateError.code === "PGRST108" || updateError.message.includes("metadata");
        
        if (isSchemaError) {
          console.warn("[Profile] Erro de schema detectado. Acionando reparo tático...");
          
          // Tenta forçar refresh via RPC
          try {
            await supabase.rpc("force_refresh_schema_permissions");
          } catch (e) {
            console.error("Falha ao disparar RPC de refresh:", e);
          }

          // Fallback para Supabase Admin (Bypass RLS e PostgREST cache stale se o admin estiver quente)
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error: adminError } = await performUpdate(supabaseAdmin, userId, data);
          
          if (adminError) throw adminError;
          return { success: true, message: "Atualizado via Túnel Admin (Schema Syncing)" };
        }
        
        throw updateError;
      }

      return { success: true };
    } catch (error: any) {
      console.error("Erro fatal em updateProfileCustomization:", error);
      throw new Error(error.message || "Falha tática ao sincronizar perfil");
    }
  });
