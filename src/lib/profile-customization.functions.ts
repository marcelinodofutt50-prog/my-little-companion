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

      // 1. Fetch current data via Admin Tunnel for absolute precision
<<<<<<< HEAD
      let profile: any = null;
      let metadataColumnPresent = true;

      const { data: fetchedProfile, error: fetchError } = await supabaseAdmin
=======
      const { data: profile, error: fetchError } = await supabaseAdmin
>>>>>>> origin/main
        .from("profiles")
        .select("metadata, display_name")
        .eq("id", userId)
        .maybeSingle();

<<<<<<< HEAD
      if (fetchError) {
        console.error("[Profile Audit] Fetch Error:", fetchError);
        if (fetchError.code === "42703" || String(fetchError.message).includes("metadata")) {
          metadataColumnPresent = false;
          const { data: fallbackProfile, error: fallbackError } = await supabaseAdmin
            .from("profiles")
            .select("display_name")
            .eq("id", userId)
            .maybeSingle();
          if (fallbackError || !fallbackProfile) {
            console.error("[Profile Audit] Fallback fetch failed:", fallbackError);
            throw new Error(`Erro ao recuperar perfil: ${fallbackError?.message || 'Perfil inexistente'}`);
          }
          profile = fallbackProfile;
        } else {
          throw new Error(`Erro ao recuperar perfil: ${fetchError.message}`);
        }
      } else {
        profile = fetchedProfile;
      }

      if (!profile) {
        throw new Error("Erro ao recuperar perfil: Perfil inexistente");
      }

      const currentMetadata = metadataColumnPresent ? ((profile?.metadata as any) || {}) : {};
      if (data.avatar_url) currentMetadata.avatar_url = data.avatar_url;
      if (data.is_anonymous !== undefined) currentMetadata.is_anonymous = data.is_anonymous;

      const finalUpdates: any = {
        updated_at: new Date().toISOString(),
      };

      if (metadataColumnPresent) {
        finalUpdates.metadata = currentMetadata;
      }
      if (data.nickname) finalUpdates.display_name = data.nickname;

      if (!metadataColumnPresent && (data.avatar_url || data.is_anonymous !== undefined)) {
        throw new Error(
          "Não foi possível salvar avatar ou anonimato porque a coluna `profiles.metadata` não existe. Execute a migração e sincronize o schema."
        );
      }

=======
      if (fetchError || !profile) {
        console.error("[Profile Audit] Fetch Error:", fetchError);
        // Fallback for new profiles if they don't exist yet
        if (!profile) console.warn("[Profile Audit] Profile not found for user:", userId);
        throw new Error(`Erro ao recuperar perfil: ${fetchError?.message || 'Perfil inexistente'}`);
      }
      
      const currentMetadata = (profile?.metadata as any) || {};
      if (data.avatar_url) currentMetadata.avatar_url = data.avatar_url;
      if (data.is_anonymous !== undefined) currentMetadata.is_anonymous = data.is_anonymous;
      
      const finalUpdates: any = {
        metadata: currentMetadata,
        updated_at: new Date().toISOString()
      };
      
      if (data.nickname) finalUpdates.display_name = data.nickname;

>>>>>>> origin/main
      // 2. Perform Update via Admin Tunnel to bypass PostgREST cache issues
      const timestamp = new Date().toISOString();
      console.log(`[Profile Audit] [${timestamp}] [DEBUG] Executando Update para:`, userId, finalUpdates);
      const { data: updateRes, error: updateError, status, statusText } = await supabaseAdmin
        .from("profiles")
        .update(finalUpdates)
        .eq("id", userId)
        .select();

      if (updateError) {
        console.error(`[Profile Audit] [${timestamp}] [ERROR] Update Failed:`, {
          code: updateError.code,
          message: updateError.message,
          hint: updateError.hint,
          details: updateError.details,
          http_status: status,
          http_text: statusText,
          userId
        });
        
        if (updateError.code === "42703") {
            throw new Error(`[Profile] Coluna inexistente (${updateError.code}): ${updateError.message}. Execute a sincronização de schema.`);
        }
        throw new Error(`[Profile] Erro no banco (${updateError.code}): ${updateError.message} (HTTP ${status})`);
      }

      console.log("[Profile Audit] Update Success:", updateRes);
      return { success: true, updated: updateRes };
    } catch (error: any) {
      console.error("Erro Crítico em updateProfileCustomization:", error);
      throw new Error(error.message || "Falha técnica ao sincronizar perfil");
    }
  });
