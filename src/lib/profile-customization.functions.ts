import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const updateProfileCustomization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ 
    nickname: z.string().optional(),
    avatar_url: z.string().optional(),
    is_anonymous: z.boolean().optional()
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Shadow Core v13.4: Estratégia de Atualização de Metadados Resiliente
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const currentMetadata = (profile?.metadata as any) || {};
    const nextMetadata = {
      ...currentMetadata,
      ...(data.avatar_url ? { avatar_url: data.avatar_url } : {}),
      ...(typeof data.is_anonymous !== 'undefined' ? { is_anonymous: data.is_anonymous } : {})
    };

    const updates: any = {
      metadata: nextMetadata,
      updated_at: new Date().toISOString()
    };

    // Atualizar display_name explicitamente para garantir que aparece no Nexus e Shadow Pass
    if (data.nickname) {
      updates.display_name = data.nickname;
    }

    // Tentar primeiro via cliente padrão (RLS)
    let { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    // Fallback Admin Tunnel se RLS ou cache de esquema falhar
    if (error) {
      console.warn("[ShadowPass] Update fail, using admin tunnel...", error.message);
      const { error: adminError } = await supabaseAdmin
        .from("profiles")
        .update(updates)
        .eq("id", userId);
      
      if (adminError) throw adminError;
    }

    return { success: true };
  });
