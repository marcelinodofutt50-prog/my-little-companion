import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Retorna a thread aberta do usuário. Se a última thread estiver fechada
 * (status = 'closed'), cria uma nova automaticamente. Assim o cliente sempre
 * enxerga um "novo ticket" pronto para conversar após um atendimento encerrado.
 */
export const getOrCreateThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: existing } = await context.supabase
      .from("support_threads")
      .select("*")
      .eq("user_id", context.userId)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return existing;
    const { data, error } = await context.supabase
      .from("support_threads")
      .insert({ user_id: context.userId, subject: "Suporte Shadow", status: "open" })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  });

/**
 * Lista threads do próprio usuário (histórico) para permitir consultar
 * atendimentos passados encerrados.
 */
export const listMyThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("support_threads")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
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

/**
 * Marca a thread como lida pelo cliente (zera unread_by_customer).
 */
export const markThreadReadByCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ threadId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("support_threads")
      .update({ unread_by_customer: 0 })
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    return { ok: true };
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
    const [adminRes, modRes] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "moderator" }),
    ]);
    const isStaff = !!adminRes.data || !!modRes.data;

    // Load thread once; validate access and closed-state.
    const { data: thread, error: tErr } = await context.supabase
      .from("support_threads")
      .select("id, user_id, status")
      .eq("id", data.threadId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!thread) throw new Error("Conversa não encontrada");

    // Non-staff can only post in their own non-closed thread.
    let effectiveThreadId = data.threadId;
    if (!isStaff) {
      if (thread.user_id !== context.userId) throw new Error("Acesso negado a esta conversa");
      if (thread.status === "closed") {
        // Auto-open a fresh thread for the customer and post there.
        const { data: nt, error: nErr } = await context.supabase
          .from("support_threads")
          .insert({ user_id: context.userId, subject: "Suporte Shadow", status: "open" })
          .select("id")
          .single();
        if (nErr) throw nErr;
        effectiveThreadId = nt.id;
      }
    } else {
      // Staff sending into a closed thread is allowed (they may want to add a follow-up).
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
      thread_id: effectiveThreadId,
      sender_id: context.userId,
      is_admin: isStaff,
      body: data.body ?? null,
      attachment_url: url,
      attachment_type: data.attachmentType ?? null,
    }).select("*").single();
    if (error) throw error;
    return { ...msg, thread_id: effectiveThreadId };
  });
