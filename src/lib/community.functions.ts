import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCommunityMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await (supabase
      .from("community_messages" as any)
      .select("id, content, created_at, profiles(display_name, metadata)")
      .order("created_at", { ascending: false })
      .limit(50) as any);

    if (error) {
      console.error("[Community] Error fetching messages:", error);
      return [];
    }
    return data || [];
  });

export const sendCommunityMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ content: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase
      .from("community_messages" as any)
      .insert({
        user_id: userId,
        content: data.content
      } as any));

    if (error) throw error;
    return { ok: true };
  });
