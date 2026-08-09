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
      if (data.nickname) updates.display_name = data.nickname;
      
      // Armazena preferências no JSONB metadata
      // Primeiro buscamos o perfil para não sobrescrever outros campos do metadata
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("metadata")
        .eq("id", userId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      const metadata = (profile?.metadata as any) || {};
      if (data.avatar_url) metadata.avatar_url = data.avatar_url;
      if (data.is_anonymous !== undefined) metadata.is_anonymous = data.is_anonymous;
      
      updates.metadata = metadata;

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (updateError) {
        // Se falhar por causa da coluna faltando (cache do postgrest), tentamos o RPC e retry
        if (updateError.message.includes("metadata") || updateError.code === "PGRST108") {
          console.warn("Detectado erro de cache de schema (metadata). Tentando auto-reparo...");
          await supabase.rpc("force_refresh_schema_permissions");
          
          // Pequeno delay para o cache limpar
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const { error: retryError } = await supabase
            .from("profiles")
            .update(updates)
            .eq("id", userId);
            
          if (retryError) throw retryError;
        } else {
          throw updateError;
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error("Erro em updateProfileCustomization:", error);
      throw new Error(error.message || "Falha interna ao atualizar perfil");
    }
  });
