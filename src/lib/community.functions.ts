import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCommunityMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await (supabase
      .from("community_messages")
      .select("id, content, created_at, user_id, profiles(display_name, metadata)")
      .order("created_at", { ascending: false })
      .limit(50) as any);

    if (error) {
      console.error("[Community] Error fetching messages:", error);
      // Auto-heal attempt if schema is detected as stale
      if (error.message?.includes("schema cache")) {
        await supabase.rpc('force_refresh_schema_permissions').catch(console.error);
      }
      return [];
    }
    return data || [];
  });

export const sendCommunityMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ content: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    // Check anonymity preference from profile first
    const { data: profile } = await (supabase
      .from("profiles")
      .select("metadata")
      .eq("id", userId)
      .single() as any);
      
    const isAnonymous = (profile?.metadata as any)?.is_anonymous ?? false;

    const { error } = await (supabase
      .from("community_messages")
      .insert({
        user_id: userId,
        content: data.content,
        // The display logic is handled via profile metadata in the list view, 
        // but we ensure the message exists.
      } as any));

    if (error) {
       if (error.message?.includes("schema cache")) {
        await supabase.rpc('force_refresh_schema_permissions').catch(console.error);
      }
      throw error;
    }
    return { ok: true };
  });

export const getCommunityGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await (supabase
      .from("community_goals")
      .select("*")
      .order("target_members", { ascending: true }) as any);

    if (error) {
      if (error.message?.includes("schema cache")) {
        await supabase.rpc('force_refresh_schema_permissions').catch(console.error);
      }
      return [];
    }
    return data || [];
  });

