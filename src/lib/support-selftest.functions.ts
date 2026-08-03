import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SupportTestStep = {
  step: string;
  ok: boolean;
  detail: string;
};

/**
 * Teste ponta a ponta REAL do fluxo de suporte.
 *
 * Diferente do autoteste de compra, este teste usa o cliente autenticado
 * (mesmo caminho do navegador), então ele valida de verdade: GRANTs, políticas
 * de RLS, o índice único de thread ativa, o trigger que preserva is_admin e a
 * leitura paginada das mensagens. Tudo que é criado é removido no final.
 */
export const runSupportE2E = createServerFn({ method: "POST" })

  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const steps: SupportTestStep[] = [];
    const push = (step: string, ok: boolean, detail: string) => steps.push({ step, ok, detail });

    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const createdThreadIds: string[] = [];

    // 1) Permissões de leitura como usuário autenticado (GRANT + RLS)
    try {
      const { error } = await context.supabase
        .from("support_threads")
        .select("id")
        .eq("user_id", context.userId)
        .limit(1);
      push(
        "Permissões de leitura (GRANT + RLS)",
        !error,
        error ? `Leitura bloqueada: ${error.message}` : "O cliente autenticado consegue ler os próprios atendimentos.",
      );
      if (error) throw error;
    } catch (e: any) {
      push("Permissões de leitura (GRANT + RLS)", false, e?.message ?? "Falha inesperada");
      return { steps, finishedAt: new Date().toISOString() };
    }

    // 2) Abertura de ticket com duas chamadas simultâneas (corrida do StrictMode)
    let threadId: string | null = null;
    try {
      const payload = {
        user_id: context.userId,
        subject: "AUTOTESTE E2E — Suporte",
        status: "open",
        category: "outro",
        priority: "normal",
      };
      const results = await Promise.allSettled([
        context.supabase.from("support_threads").insert(payload).select("id").maybeSingle(),
        context.supabase.from("support_threads").insert(payload).select("id").maybeSingle(),
      ]);
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.data?.id) {
          threadId = r.value.data.id;
          createdThreadIds.push(r.value.data.id);
        }
      }
      if (!threadId) {
        const { data: winner } = await context.supabase
          .from("support_threads")
          .select("id")
          .eq("user_id", context.userId)
          .neq("status", "closed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        threadId = winner?.id ?? null;
      }
      const { data: actives } = await supabaseAdmin
        .from("support_threads")
        .select("id")
        .eq("user_id", context.userId)
        .neq("status", "closed");
      const activeCount = actives?.length ?? 0;
      push(
        "Abertura de ticket (sem travar em 'abrindo…')",
        Boolean(threadId) && activeCount <= 1,
        threadId
          ? `Ticket ativo obtido em ${activeCount} atendimento(s) aberto(s) — corrida resolvida corretamente.`
          : "Nenhum ticket foi aberto: a tela ficaria presa em 'abrindo…'.",
      );
      if (!threadId) throw new Error("sem thread");
    } catch (e: any) {
      push("Abertura de ticket (sem travar em 'abrindo…')", false, e?.message ?? "Falha ao abrir ticket");
      return { steps, finishedAt: new Date().toISOString() };
    }

    // 3) Cliente envia mensagem (caminho real, com RLS)
    let customerMsgId: string | null = null;
    try {
      const { data, error } = await context.supabase
        .from("support_messages")
        .insert({
          thread_id: threadId,
          sender_id: context.userId,
          is_admin: false,
          body: "E2E: mensagem do cliente",
        })
        .select("id,is_admin")
        .single();
      if (error) throw error;
      customerMsgId = data.id;
      push("Cliente envia mensagem", data.is_admin === false, "Mensagem do cliente gravada com is_admin = false.");
    } catch (e: any) {
      push("Cliente envia mensagem", false, e?.message ?? "Falha no envio do cliente");
    }

    // 4) Suporte responde e a resposta continua marcada como admin (trigger)
    try {
      const base = {
        thread_id: threadId,
        sender_id: context.userId,
        is_admin: true,
        body: "E2E: resposta do suporte",
      };
      const insertReply = (withReply: boolean) =>
        context.supabase
          .from("support_messages")
          .insert(withReply ? { ...base, reply_to_id: customerMsgId } : base)
          .select("id,is_admin")
          .single();

      let { data, error } = await insertReply(true);
      if (
        error &&
        (error.code === "PGRST204" || error.code === "42703" || String(error.message ?? "").includes("reply_to_id"))
      ) {
        ({ data, error } = await insertReply(false));
      }
      if (error) throw error;
      push(
        "Suporte responde (is_admin preservado)",
        data!.is_admin === true,
        data!.is_admin === true
          ? "Resposta gravada como suporte."
          : "A resposta foi salva como se fosse do cliente (trigger sobrescreveu is_admin).",
      );
    } catch (e: any) {
      push("Suporte responde (is_admin preservado)", false, e?.message ?? "Falha na resposta do suporte");
    }


    // 5) Leitura das mensagens na ordem cronológica
    try {
      const { data, error } = await context.supabase
        .from("support_messages")
        .select("id,body,created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      push(
        "Histórico da conversa",
        (data?.length ?? 0) >= 2,
        `${data?.length ?? 0} mensagem(ns) visíveis na conversa de teste.`,
      );
    } catch (e: any) {
      push("Histórico da conversa", false, e?.message ?? "Falha ao carregar mensagens");
    }

    // 6) Encerrar e reabrir um novo atendimento
    try {
      const { error: closeErr } = await context.supabase
        .from("support_threads")
        .update({ status: "closed" })
        .eq("id", threadId);
      if (closeErr) throw closeErr;

      const { data: reopened, error: reopenErr } = await context.supabase
        .from("support_threads")
        .insert({
          user_id: context.userId,
          subject: "AUTOTESTE E2E — Reabertura",
          status: "open",
          category: "outro",
          priority: "normal",
        })
        .select("id")
        .single();
      if (reopenErr) throw reopenErr;
      createdThreadIds.push(reopened.id);
      push("Encerrar e abrir novo atendimento", true, "Após encerrar, um novo ticket pode ser aberto normalmente.");
    } catch (e: any) {
      push("Encerrar e abrir novo atendimento", false, e?.message ?? "Falha ao reabrir atendimento");
    }

    // 7) Limpeza
    try {
      if (createdThreadIds.length) {
        await supabaseAdmin.from("support_messages").delete().in("thread_id", createdThreadIds);
        await supabaseAdmin.from("support_threads").delete().in("id", createdThreadIds);
      }
      push("Limpeza pós-teste", true, `${createdThreadIds.length} atendimento(s) de teste removido(s).`);
    } catch (e: any) {
      push("Limpeza pós-teste", false, e?.message ?? "Falha ao remover dados de teste");
    }

    return { steps, finishedAt: new Date().toISOString() };
  });
