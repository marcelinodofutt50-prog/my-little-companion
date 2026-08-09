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

    const updates: any = {};
    if (data.nickname) updates.display_name = data.nickname;
    
    // Armazena preferências no JSONB metadata
    const { data: profile } = await supabase
      .from("profiles")
      .select("metadata")
      .eq("id", userId)
      .single();
    
    const metadata = (profile?.metadata as any) || {};
    if (data.avatar_url) metadata.avatar_url = data.avatar_url;
    if (data.is_anonymous !== undefined) metadata.is_anonymous = data.is_anonymous;
    
    updates.metadata = metadata;

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) {
      if (error.message.includes("metadata")) {
        // Tentativa de reparo silencioso em caso de stale cache bridge
        await supabase.rpc("force_refresh_schema_permissions");
      }
      throw error;
    }

    return { success: true };
  });
