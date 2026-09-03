import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertStaffChannelAccess,
  throwStaffChannelError,
  assertChannelMembership,
  dmChannelFor,
} from "./staff-chat.server";

export const getStaffMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ channel: z.string().default("general") }).parse(data ?? {}),
  )
  .handler(async ({ data: input, context }) => {
    const { userId } = context;
    const { supabaseAdmin, role } = await assertStaffChannelAccess(userId, (context as any).supabase);
    assertChannelMembership(input.channel, userId);

    const { data: rows, error } = await supabaseAdmin
      .from("staff_messages")
      .select("id, content, created_at, sender_id")
      .eq("channel", input.channel)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throwStaffChannelError(error as any, "Carregar mensagens");

    const list = (rows || []).slice().reverse();
    const ids = Array.from(new Set(list.map((m: any) => m.sender_id).filter(Boolean)));

    const profileMap = new Map<string, any>();
    const roleMap = new Map<string, string>();

    if (ids.length) {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, display_name, full_name, email, avatar_url, metadata")
          .in("id", ids),
        supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      for (const p of profiles || []) profileMap.set((p as any).id, p);
      for (const r of roles || []) {
        const current = roleMap.get((r as any).user_id);
        // admin tem prioridade na exibição
        if (!current || (r as any).role === "admin") roleMap.set((r as any).user_id, (r as any).role);
      }
    }

    const messages = list.map((m: any) => {
      const p = profileMap.get(m.sender_id) || {};
      const meta = (p.metadata as any) || {};
      return {
        id: m.id,
        content: m.content,
        created_at: m.created_at,
        sender_id: m.sender_id,
        isMine: m.sender_id === userId,
        author:
          meta.nickname ||
          p.display_name ||
          p.full_name ||
          p.email?.split("@")[0] ||
          "Membro da equipe",
        avatar: meta.avatar_url || p.avatar_url || null,
        sender_role: roleMap.get(m.sender_id) || "staff",
      };
    });

    return { messages, myRole: role, myId: userId };
  });

export const sendStaffMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        content: z.string().trim().min(1).max(2000),
        channel: z.string().default("general"),
      })
      .parse(data),
  )
  .handler(async ({ data: input, context }) => {
    const { userId } = context;
    const { supabaseAdmin, role } = await assertStaffChannelAccess(userId, (context as any).supabase);
    assertChannelMembership(input.channel, userId);

    const { data, error } = await supabaseAdmin
      .from("staff_messages")
      .insert({
        sender_id: userId,
        content: input.content,
        channel: input.channel,
        metadata: { role },
      })
      .select("id, content, created_at, sender_id")
      .single();

    if (error) throwStaffChannelError(error as any, "Enviar mensagem");
    return data;
  });

export const deleteStaffMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin, role } = await assertStaffChannelAccess(userId, (context as any).supabase);

    let q = supabaseAdmin.from("staff_messages").delete().eq("id", data.id);
    // Admin pode remover qualquer mensagem; demais só as próprias.
    if (role !== "admin") q = q.eq("sender_id", userId);

    const { error } = await q;
    if (error) throwStaffChannelError(error as any, "Apagar mensagem");
    return { ok: true };
  });

/** Lista os membros da equipe disponíveis para conversa privada. */
export const listStaffDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await assertStaffChannelAccess(userId, (context as any).supabase);

    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "moderator", "support"]);

    if (error) throwStaffChannelError(error as any, "Listar equipe");

    const roleMap = new Map<string, string>();
    for (const r of roles ?? []) {
      const uid = (r as any).user_id as string;
      const current = roleMap.get(uid);
      if (!current || (r as any).role === "admin") roleMap.set(uid, (r as any).role);
    }
    const ids = Array.from(roleMap.keys()).filter((id) => id !== userId);
    if (!ids.length) return { members: [] as any[] };

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, full_name, email, avatar_url, metadata")
      .in("id", ids);

    const members = (profiles ?? []).map((p: any) => {
      const meta = (p.metadata as any) || {};
      return {
        id: p.id as string,
        name:
          meta.nickname ||
          p.display_name ||
          p.full_name ||
          p.email?.split("@")[0] ||
          "Membro da equipe",
        avatar: meta.avatar_url || p.avatar_url || null,
        role: roleMap.get(p.id) ?? "staff",
        channel: dmChannelFor(userId, p.id),
      };
    });

    members.sort((a, b) => a.name.localeCompare(b.name));
    return { members };
  });
