import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOrCreateThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: existing } = await context.supabase
      .from("support_threads").select("*").eq("user_id", context.userId).eq("status", "open").maybeSingle();
    if (existing) return existing;
    const { data, error } = await context.supabase
      .from("support_threads").insert({ user_id: context.userId, subject: "Suporte Shadow" }).select("*").single();
    if (error) throw error;
    return data;
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ threadId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: msgs, error } = await context.supabase
      .from("support_messages").select("*").eq("thread_id", data.threadId).order("created_at", { ascending: true });
    if (error) throw error;
    return msgs ?? [];
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    threadId: z.string().uuid(),
    body: z.string().trim().min(1).max(4000).optional(),
    attachmentPath: z.string().min(1).max(512).optional(),
    attachmentType: z.string().max(100).optional(),
  }).refine((v) => !!v.body || !!v.attachmentPath, { message: "Mensagem vazia" }).parse(i))
  .handler(async ({ data, context }) => {
    // Role check using the authenticated Supabase client (RLS + has_role).
    // The DB trigger enforce_support_msg_admin_flag is the source of truth —
    // this API call keeps the client payload consistent so the UI reflects
    // the same value the DB will persist.
    const [adminRes, modRes] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "moderator" }),
    ]);
    const isStaff = !!adminRes.data || !!modRes.data;

    // Non-staff can only post in their own open thread. RLS already enforces
    // this, but validating here returns a friendlier error than a policy denial.
    if (!isStaff) {
      const { data: thread, error: tErr } = await context.supabase
        .from("support_threads")
        .select("id, user_id, status")
        .eq("id", data.threadId)
        .maybeSingle();
      if (tErr) throw tErr;
      if (!thread || thread.user_id !== context.userId) {
        throw new Error("Acesso negado a esta conversa");
      }
      if (thread.status !== "open") {
        throw new Error("Conversa encerrada");
      }
    }

    let url: string | null = null;
    if (data.attachmentPath) {
      const { data: signed, error: sErr } = await context.supabase.storage
        .from("support-media")
        .createSignedUrl(data.attachmentPath, 60 * 60 * 24 * 7);
      if (sErr) throw sErr;
      url = signed?.signedUrl ?? null;
    }

    const { data: msg, error } = await context.supabase.from("support_messages").insert({
      thread_id: data.threadId,
      sender_id: context.userId,
      is_admin: isStaff, // trigger will re-force this server-side
      body: data.body ?? null,
      attachment_url: url,
      attachment_type: data.attachmentType ?? null,
    }).select("*").single();
    if (error) throw error;
    return msg;
  });
