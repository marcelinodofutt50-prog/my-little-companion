import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SUPPORT_CATEGORIES } from "@/lib/support-categories";
import { trackSchemaFailure } from "./tutorials.functions";

/**
 * Retorna a thread aberta do usuário. Se a última thread estiver fechada
 * (status = 'closed'), cria uma nova automaticamente. Assim o cliente sempre
 * enxerga um "novo ticket" pronto para conversar após um atendimento encerrado.
 *
 * Vale para qualquer conta (inclusive staff): quem abre a aba de suporte
 * precisa conseguir escrever, senão o ticket fica "indisponível".
 */

export const getOrCreateThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Tática de carregamento resiliente via Admin para evitar PGRST108
    const fetchExisting = async (client: any) => client
      .from("support_threads")
      .select("*")
      .eq("user_id", context.userId)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let { data: existing, error: existingError } = await fetchExisting(context.supabase);

    if (existingError && (existingError.code === 'PGRST108' || existingError.message?.includes('schema cache'))) {
      console.warn("[getOrCreateThread] Schema sync issue detected. Falling back to admin tunnel...");
      await trackSchemaFailure(existingError, "getOrCreateThread", false, { stage: "check_existing_client" }, context.userId);
      const adminResult = await fetchExisting(supabaseAdmin);
      existing = adminResult.data;
      if (!adminResult.error) {
        await trackSchemaFailure(existingError, "getOrCreateThread", true, { stage: "check_existing_admin_success" }, context.userId);
      }
    }

    if (existing) return existing;

    const threadPayload = {
      user_id: context.userId,
      subject: "Suporte Shadow",
      status: "open",
      category: "outro",
      priority: "normal"
    };
    
    async function doCreate(client: any, p: any) {
      return client.from("support_threads").insert(p).select("*").maybeSingle();
    }

    // Tenta criar via Admin diretamente para maior estabilidade em escritas críticas de sistema
    let { data, error } = await doCreate(supabaseAdmin, threadPayload);
    
    // Fallback para colunas novas (category/priority) se o cache falhar mesmo no Admin
    if (error && (error as any).code === "PGRST204") {
      const { category, priority, ...fallback } = threadPayload;
      const retry = await doCreate(supabaseAdmin, fallback);
      data = retry.data;
      error = retry.error;
    }

    // Duas chamadas simultâneas (ex.: StrictMode/HMR) podem tentar abrir o
    // mesmo atendimento. O índice do banco preserva apenas uma thread ativa;
    // nesse caso devolvemos a que venceu a corrida.
    if (error && (error as any).code === "23505") {
      const winner = await fetchExisting(supabaseAdmin);
      if (winner.error) throw winner.error;
      if (winner.data) return winner.data;
    }

    if (error) {
      await trackSchemaFailure(error, "getOrCreateThread", false, { stage: "final_creation_fail" }, context.userId);
      throw error;
    }
    
    if (!data) throw new Error("Não foi possível abrir o atendimento");
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
    
    if (error && (error.code === 'PGRST108' || error.message?.includes('schema cache'))) {
      await trackSchemaFailure(error, "listMyThreads", false, { stage: "initial_fetch" }, context.userId);
      const { data: adminData, error: adminError } = await (await import("@/integrations/supabase/client.server")).supabaseAdmin
        .from("support_threads")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (!adminError) {
        await trackSchemaFailure(error, "listMyThreads", true, { stage: "retry_success" }, context.userId);
        return adminData ?? [];
      }
    }

    if (error) throw error;
    return data ?? [];
  });

/**
 * Lista mensagens de forma paginada (mais recentes primeiro no banco,
 * devolvidas em ordem cronológica). Use `before` (created_at ISO da mensagem
 * mais antiga já carregada) para buscar o histórico anterior.
 */
export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i: any) => {
    return z.object({
      threadId: z.string().uuid(),
      limit: z.number().int().min(5).max(100).optional(),
      before: z.string().optional(),
    }).parse(i);
  })
  .handler(async ({ data, context }) => {
    const limit = data.limit ?? 30;
    const fetchMessages = async (client: any) => {
      let q = client
        .from("support_messages")
        .select("*")
        .eq("thread_id", data.threadId)
        .order("created_at", { ascending: false })
        .limit(limit + 1);
      if (data.before) q = q.lt("created_at", data.before);
      return q;
    };

    let { data: rows, error } = await fetchMessages(context.supabase);

    if (error && (error.code === 'PGRST108' || error.message?.includes('schema cache'))) {
      await trackSchemaFailure(error, "listMessages", false, { stage: "initial_fetch" }, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const adminResult = await fetchMessages(supabaseAdmin);
      rows = adminResult.data;
      error = adminResult.error;
      if (!error) {
        await trackSchemaFailure(error, "listMessages", true, { stage: "retry_success" }, context.userId);
      }
    }

    if (error) throw error;
    const { normalizeSupportMessages } = await import("./support-message");
    const list = normalizeSupportMessages(rows, data.threadId);
    const hasMore = list.length > limit;
    const page = hasMore ? list.slice(0, limit) : list;
    return { messages: page.reverse(), hasMore };

  });


/**
 * Marca a thread como lida pelo cliente (zera unread_by_customer).
 */
export const markThreadReadByCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: any) => {
    return z.object({ threadId: z.string().uuid() }).parse(i);
  })
  .handler(async ({ data, context }) => {
    console.log(`[Support] Marking thread ${data.threadId} as read by customer ${context.userId}`);
    
    const { error } = await context.supabase
      .from("support_threads")
      .update({ unread_by_customer: 0 })
      .eq("id", data.threadId)
      .eq("user_id", context.userId);

    if (error) {
      console.error(`[Support] Failed to mark thread ${data.threadId} as read:`, error);
      
      if (error.code === 'PGRST108' || error.message?.includes('schema cache')) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        console.warn("[Support] Schema cache error in markRead, retrying via admin tunnel...");
        await supabaseAdmin
          .from("support_threads")
          .update({ unread_by_customer: 0 })
          .eq("id", data.threadId);
      }
    }
    
    return { ok: true };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: any) => {
    return z.object({
      threadId: z.string().uuid(),
      body: z.string().trim().min(1).max(4000).optional(),
      attachmentPath: z.string().min(1).max(512).optional(),
      attachmentType: z.string().max(100).optional(),
      replyToId: z.string().uuid().optional().nullable(),
    }).refine((v) => !!v.body || !!v.attachmentPath, { message: "Mensagem vazia" }).parse(i);
  })
  .handler(async ({ data, context }) => {
    const { resolveRoles } = await import("@/lib/roles.server");
    const { isStaff } = await resolveRoles(context);

    // Load thread once; validate access and closed-state.
    const fetchThread = async (client: any) => client
      .from("support_threads")
      .select("id, user_id, status")
      .eq("id", data.threadId)
      .maybeSingle();

    let { data: thread, error: tErr } = await fetchThread(context.supabase);
    
    if (tErr && (tErr.code === 'PGRST108' || tErr.message?.includes('schema cache'))) {
      await trackSchemaFailure(tErr, "sendMessage", false, { stage: "fetch_thread" }, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const adminResult = await fetchThread(supabaseAdmin);
      thread = adminResult.data;
      const error = adminResult.error;
      if (!error) {
        await trackSchemaFailure(tErr, "sendMessage", true, { stage: "retry_fetch_thread_success" }, context.userId);
      }
    }

    if (tErr && !thread) throw tErr;
    if (!thread) throw new Error("Conversa não encontrada");

    // Non-staff can only post in their own non-closed thread.
    let effectiveThreadId = data.threadId;
    if (!isStaff) {
      // For clients, ensure they are sending to their own thread
      if (thread.user_id !== context.userId) throw new Error("Acesso negado a esta conversa");
      
      // Auto-reopen logic if thread was closed
      if (thread.status === "closed") {
        // Auto-open a fresh thread for the customer and post there.
        const ntPayload = {
          user_id: context.userId,
          subject: "Suporte Shadow",
          status: "open",
          category: "outro",
          priority: "normal"
        };
        
        async function doCreate(p: any) {
          // Utiliza console.error para capturar falhas de inserção silenciosas
          const result = await context.supabase.from("support_threads").insert(p).select("id").maybeSingle();
          if (result.error) console.error("[support.functions] Thread creation error:", result.error);
          return result;
        }
        
        let { data: nt, error: nErr } = await doCreate(ntPayload);
        
        if (nErr && (nErr as any).code === "PGRST204") {
          const { category, priority, ...fallback } = ntPayload;
          const retry = await doCreate(fallback);
          nt = retry.data;
          nErr = retry.error;
        }

        if (nErr || !nt) throw nErr || new Error("Falha ao criar atendimento");
        effectiveThreadId = nt.id;
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

    // Build payload dynamically to avoid schema cache issues with reply_to_id
    const payload: any = {
      thread_id: effectiveThreadId,
      sender_id: context.userId,
      is_admin: isStaff,
      body: data.body ?? null,
      attachment_url: url,
      attachment_type: data.attachmentType ?? null,
    };

    // Only add reply_to_id if it's explicitly provided
    if (data.replyToId) {
      payload.reply_to_id = data.replyToId;
    }

    async function doInsert(p: any) {
      const result = await context.supabase.from("support_messages").insert(p).select("*").maybeSingle();
      if (result.error) console.error("[support.functions] Message insertion error:", result.error);
      return result;
    }

    let { data: msg, error } = await doInsert(payload);

    // Fallback: se o cache de schema do PostgREST estiver desatualizado ou a
    // coluna opcional reply_to_id não existir, reenvia sem ela.
    const replyColMissing = (e: any) =>
      e && (e.code === "PGRST204" || e.code === "42703" || String(e.message ?? "").includes("reply_to_id"));
    if (replyColMissing(error) && payload.reply_to_id) {
      console.warn("[sendMessage] reply_to_id indisponível, reenviando sem citação...");
      const { reply_to_id, ...fallback } = payload;
      const retry = await doInsert(fallback);
      msg = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("[sendMessage] Insertion failed after fallback:", error);
      if (error.code === 'PGRST108' || error.message?.includes('schema cache')) {
         await trackSchemaFailure(error, "sendMessage", false, { stage: "insertion_fail" }, context.userId);
      }
      // Last resort fallback: minimal insert to ensure message is not lost
      const minimalPayload = { 
        thread_id: effectiveThreadId, 
        sender_id: context.userId, 
        is_admin: isStaff,
        body: data.body ?? "Mensagem enviada (anexo)" 
      };
      const { data: final, error: finalErr } = await context.supabase.from("support_messages").insert(minimalPayload).select("*").maybeSingle();
      if (finalErr) throw finalErr;
      msg = final;
    }
    
    // Inicia análise por IA se não for staff e a mensagem contiver gatilhos de erro de login
    if (!isStaff && data.body) {
      const { triggerSupportAI } = await import("./support-ai.server");
      // Rodamos em background sem dar await para não travar a resposta do usuário
      triggerSupportAI(effectiveThreadId, context.userId, data.body).catch(e => {
        console.error("[support-ai] background trigger failed:", e);
      });

      // Política de conduta do teste grátis (revenda / instalação em terceiros)
      const { enforceTrialConduct } = await import("./trial-misconduct.server");
      enforceTrialConduct({
        threadId: effectiveThreadId,
        userId: context.userId,
        message: data.body,
      }).catch(e => {
        console.error("[trial-conduct] background check failed:", e);
      });
    }

    const { normalizeSupportMessage } = await import("./support-message");
    return normalizeSupportMessage(msg, effectiveThreadId);

  });

/**
 * Define a categoria (assunto) do atendimento do próprio cliente.
 * Categorias válidas são fixas para evitar entrada livre no banco.
 */
export const setThreadCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: any) => {
    return z.object({
      threadId: z.string().uuid(),
      category: z.enum(SUPPORT_CATEGORIES as any),
      subject: z.string().trim().min(2).max(120).optional(),
    }).parse(i);
  })
  .handler(async ({ data, context }) => {
    const priority = data.category === "servidor" || data.category === "pagamento" ? "alta" : "normal";
    const patch = {
      category: data.category,
      priority,
      subject: data.subject ?? `Suporte — ${data.category}`,
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    async function run(client: any, payload: { category?: string; priority?: string; subject?: string }) {
      return client
        .from("support_threads")
        .update(payload)
        .eq("id", data.threadId)
        .eq("user_id", context.userId)
        .select("*")
        .maybeSingle();
    }

    // Usa Admin para atualizar categorias/assuntos para evitar PGRST108/PGRST204 no cliente
    let { data: updated, error } = await run(supabaseAdmin, patch);

    // Fallback se a coluna ainda não for visível no admin (cache persistente do workerd)
    if (error && (error as any).code === "PGRST204") {
      const retry = await run(supabaseAdmin, { subject: patch.subject });
      updated = retry.data;
      error = retry.error;
    }

    if (error) {
      if (error.code === 'PGRST108' || error.message?.includes('schema cache')) {
         await trackSchemaFailure(error, "setThreadCategory", false, { stage: "admin_update_fail" }, context.userId);
      }
      throw error;
    }
    
    if (!updated) throw new Error("Conversa não encontrada");
    return updated;
  });
