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
      const { data: profile, error: fetchError } = await supabaseAdmin
        .from("profiles")
        .select("metadata, display_name, email")
        .eq("id", userId)
        .maybeSingle();

      if (fetchError) {
        console.error("[Profile Audit] Fetch Error:", fetchError);
        throw new Error(`Erro ao recuperar perfil: ${fetchError.message}`);
      }
      
      // Fallback for missing profile record - create it if it doesn't exist
      if (!profile) {
        console.warn("[Profile Audit] Profile not found, creating...", userId);
        
        // Obter email do auth.users se não estiver no profile
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
        const email = authUser?.user?.email || "unknown@shadow.dash";

        const newMetadata = { 
            avatar_url: data.avatar_url || null, 
            is_anonymous: data.is_anonymous || false 
        };
        
        const insertPayload: any = {
            id: userId,
            email: email,
            display_name: data.nickname || "Shadow Agent",
            metadata: newMetadata,
            vip_tier: 'none',
            reputation_score: 100
        };

        await supabaseAdmin.from("profiles").insert(insertPayload);
        return { success: true, created: true };
      }
      
      const currentMetadata = (profile?.metadata as any) || {};
      if (data.avatar_url) currentMetadata.avatar_url = data.avatar_url;
      if (data.is_anonymous !== undefined) currentMetadata.is_anonymous = data.is_anonymous;
      
      const finalUpdates: any = {
        metadata: currentMetadata,
        updated_at: new Date().toISOString()
      };
      
      if (data.nickname) finalUpdates.display_name = data.nickname;
      
      const { data: updateRes, error: updateError } = await supabaseAdmin
        .from("profiles")
        .update(finalUpdates)
        .eq("id", userId)
        .select();

      if (updateError) {
        throw new Error(`[Profile] Erro ao atualizar: ${updateError.message}`);
      }

      return { success: true, updated: updateRes };
    } catch (error: any) {
      console.error("Erro Crítico em updateProfileCustomization:", error);
      throw new Error(error.message || "Falha técnica ao sincronizar perfil");
    }
  });
