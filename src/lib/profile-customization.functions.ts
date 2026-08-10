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
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 1. Fetch current data to preserve metadata fields
      const { data: profile, error: fetchError } = await supabaseAdmin
        .from("profiles")
        .select("metadata, display_name")
        .eq("id", userId)
        .maybeSingle();

      if (fetchError) {
        console.error("[Profile Audit] Fetch Error:", fetchError);
        throw new Error(`Erro ao recuperar perfil: ${fetchError.message}`);
      }
      
      const currentMetadata = (profile?.metadata as any) || {};
      if (data.avatar_url) currentMetadata.avatar_url = data.avatar_url;
      if (data.is_anonymous !== undefined) currentMetadata.is_anonymous = data.is_anonymous;
      
      const finalUpdates: any = {
        metadata: currentMetadata,
        updated_at: new Date().toISOString()
      };
      
      if (data.nickname) finalUpdates.display_name = data.nickname;

      // 2. Perform Update via Admin Tunnel to bypass PostgREST cache issues
      console.log("[ Profile Audit] Executando Update para:", userId, finalUpdates);
      const { data: updateRes, error: updateError } = await supabaseAdmin
        .from("profiles")
        .update(finalUpdates)
        .eq("id", userId)
        .select();

      if (updateError) {
        console.error("[Profile Audit] Update Error Root Cause:", updateError);
        // If it's a specific column error, we provide detail
        if (updateError.code === "42703") {
            throw new Error(`Coluna inexistente no banco: ${updateError.message}. Execute a sincronização de schema.`);
        }
        throw new Error(`Erro no banco de dados (${updateError.code}): ${updateError.message}`);
      }

      console.log("[Profile Audit] Update Success:", updateRes);
      return { success: true, updated: updateRes };
    } catch (error: any) {
      console.error("Erro Crítico em updateProfileCustomization:", error);
      throw new Error(error.message || "Falha técnica ao sincronizar perfil");
    }
  });
