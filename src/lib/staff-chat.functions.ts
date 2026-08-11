import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getStaffMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { channel?: string }) => z.object({ channel: z.string().default("general") }).parse(data))
  .handler(async ({ data: input, context }) => {
    const { userId } = context;
    const { channel } = input;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Strict Role verification (Server-side)
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const allowedRoles = ['admin', 'moderator', 'support'];
    if (!roleData || !allowedRoles.includes(roleData.role)) {
      console.error(`[StaffNexus] Unauthorized access attempt by ${userId} with role ${roleData?.role}`);
      throw new Error("403: Acesso negado. O Staff Nexus é exclusivo para a equipe interna.");
    }

    // 2. Fetch messages with explicit profile join
    // We use a simpler selection to avoid serializability errors with complex types
    const { data, error } = await supabaseAdmin
      .from("staff_messages")
      .select(`
        id,
        content,
        created_at,
        sender_id,
        profiles!sender_id (
          display_name,
          full_name
        )
      `)
      .eq("channel", channel)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    
    // Flatten metadata/roles if needed, but for now just returning rows
    return (data || []).map(msg => ({
      ...msg,
      sender_role: roleData.role // In a real app we might join user_roles again for each sender
    }));
  });

export const sendStaffMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { content: string, channel?: string }) => z.object({
    content: z.string().min(1).max(2000),
    channel: z.string().default("general")
  }).parse(data))
  .handler(async ({ data: input, context }) => {
    const { userId } = context;
    const { content, channel } = input;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Strict Role verification (Server-side)
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
        channel,
        metadata: { role: roleData.role }
      })
      .select("id, content, created_at, sender_id")
      .single();

    if (error) throw error;
    return data;
  });
