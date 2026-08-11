import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getStaffMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ channel: z.string().default("general") }))
  .handler(async ({ input, context }) => {
    const { userId } = context;
    const { channel } = input;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Role verification
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const allowedRoles = ['admin', 'moderator', 'support'];
    if (!roleData || !allowedRoles.includes(roleData.role)) {
      throw new Error("403: Acesso negado. Apenas membros da equipe podem acessar este chat.");
    }

    // 2. Fetch messages
    const { data, error } = await supabaseAdmin
      .from("staff_messages")
      .select(`
        id,
        content,
        created_at,
        sender_id,
        profiles!sender_id (
          display_name,
          full_name,
          metadata
        )
      `)
      .eq("channel", channel)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  });

export const sendStaffMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    content: z.string().min(1).max(2000),
    channel: z.string().default("general")
  }))
  .handler(async ({ input, context }) => {
    const { userId } = context;
    const { content, channel } = input;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Role verification
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const allowedRoles = ['admin', 'moderator', 'support'];
    if (!roleData || !allowedRoles.includes(roleData.role)) {
      throw new Error("Unauthorized: Staff only.");
    }

    // 2. Insert message
    const { data, error } = await supabaseAdmin
      .from("staff_messages")
      .insert({
        sender_id: userId,
        content,
        channel
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  });
