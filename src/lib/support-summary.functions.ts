import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Resumo estruturado do atendimento (diagnóstico, evidências, protocolo e
 * próximos passos). É determinístico — não depende de IA — para nunca
 * quebrar o chat quando o provedor de IA estiver indisponível.
 */

export type ThreadSummary = {
  protocol: string;
  diagnosis: string;
  category: string;
  evidence: string[];
  nextSteps: string[];
  blocked: boolean;
  messageCount: number;
  lastActivity: string | null;
};

const SIGNALS: Array<{ key: string; label: string; re: RegExp; blocking?: boolean; steps: string[] }> = [
  {
    key: "licenca",
    label: "Licença não entregue / não aparece no painel",
    re: /licen[çc]a|acesso n[ãa]o veio|n[ãa]o gerou|painel vazio/i,
    blocking: true,
    steps: [
      "Confirmar o e-mail usado na compra",
      "Rodar a reconciliação do pedido (pagamento → licença)",
      "Reenviar as credenciais do painel",
    ],
  },
  {
    key: "pagamento",
    label: "Pagamento PIX pendente ou não reconhecido",
    re: /pix|pagamento|paguei|comprovante|mercado pago/i,
    blocking: true,
    steps: ["Validar o pagamento no Mercado Pago", "Anexar o comprovante", "Liberar o pedido manualmente se aprovado"],
  },
  {
    key: "bloqueio",
    label: "Bloqueio antifraude / trial negado",
    re: /bloque|antifraude|fraude|trial negad|teste gr[áa]tis negad|revogad/i,
    blocking: true,
    steps: ["Coletar o código de protocolo do bloqueio", "Revisar o dispositivo e o histórico da conta", "Liberar ou manter a decisão"],
  },
  {
    key: "instalacao",
    label: "Erro de instalação / APK / Play Protect",
    re: /apk|instal|play protect|bypass|assinat/i,
    steps: ["Confirmar a versão do Android", "Reenviar o APK gerado", "Orientar o passo a passo de instalação"],
  },
  {
    key: "servidor",
    label: "Instabilidade de servidor / login no painel",
    re: /servidor|offline|caiu|instáv|instav|n[ãa]o logo|login/i,
    blocking: true,
    steps: ["Checar o status do servidor", "Reiniciar a sessão do painel", "Informar previsão de retorno"],
  },
  {
    key: "treinamento",
    label: "Centro de Treinamento / vídeos",
    re: /treinamento|tutorial|v[íi]deo|aula/i,
    steps: ["Verificar a publicação do conteúdo", "Regerar o link assinado do vídeo"],
  },
];

const ERROR_RE = /(erro|error|falha|PGRST\d+|status\s*\d{3}|n[ãa]o (foi poss[íi]vel|consegui))/i;

function protocolFor(threadId: string, createdAt: string): string {
  const d = new Date(createdAt);
  const yy = String(d.getUTCFullYear()).slice(2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `SUP-${yy}${mm}${dd}-${threadId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export const summarizeThread = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ threadId: z.string().uuid() }).parse(i))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<ThreadSummary> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: thread } = await supabaseAdmin
      .from("support_threads")
      .select("id, user_id, category, created_at, priority")
      .eq("id", data.threadId)
      .maybeSingle();

    if (!thread) throw new Error("Conversa não encontrada");

    const { resolveRoles } = await import("@/lib/roles.server");
    const { isStaff } = await resolveRoles(context);
    if (!isStaff && thread.user_id !== context.userId) throw new Error("Acesso negado a esta conversa");

    const { data: messages } = await supabaseAdmin
      .from("support_messages")
      .select("body, is_admin, is_system, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(200);

    const list = messages ?? [];
    const customerText = list
      .filter((m) => !m.is_admin && !m.is_system)
      .map((m) => m.body ?? "")
      .join("\n");

    const matched = SIGNALS.filter((s) => s.re.test(customerText));
    const blocked = matched.some((s) => s.blocking) || ERROR_RE.test(customerText);

    const evidence: string[] = [];
    for (const m of list) {
      const body = (m.body ?? "").trim();
      if (!body) continue;
      if (ERROR_RE.test(body) || /protocolo|TRL-|SUP-/i.test(body)) {
        evidence.push(`${m.is_admin ? "Suporte" : m.is_system ? "Assistente" : "Cliente"}: ${body.slice(0, 160)}`);
      }
      if (evidence.length >= 5) break;
    }

    const nextSteps = matched.length
      ? Array.from(new Set(matched.flatMap((s) => s.steps))).slice(0, 5)
      : ["Confirmar o e-mail do painel", "Pedir print do erro", "Classificar o assunto do atendimento"];

    return {
      protocol: protocolFor(thread.id, thread.created_at ?? new Date().toISOString()),
      category: (thread.category as string) ?? "outro",
      diagnosis: matched.length
        ? matched.map((s) => s.label).join(" • ")
        : list.length
          ? "Atendimento geral — sem sinal automático de bloqueio identificado."
          : "Sem mensagens ainda. Descreva o problema para gerar o diagnóstico.",
      evidence,
      nextSteps,
      blocked,
      messageCount: list.length,
      lastActivity: list.length ? (list[list.length - 1]!.created_at as string) : null,
    };
  });

/** Encaminha o atendimento para a equipe humana com prioridade alta. */
export const escalateThread = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ threadId: z.string().uuid(), reason: z.string().trim().max(500).optional() }).parse(i),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: thread } = await supabaseAdmin
      .from("support_threads")
      .select("id, user_id, created_at")
      .eq("id", data.threadId)
      .maybeSingle();
    if (!thread) throw new Error("Conversa não encontrada");

    const { resolveRoles } = await import("@/lib/roles.server");
    const { isStaff } = await resolveRoles(context);
    if (!isStaff && thread.user_id !== context.userId) throw new Error("Acesso negado a esta conversa");

    const protocol = protocolFor(thread.id, thread.created_at ?? new Date().toISOString());

    await supabaseAdmin
      .from("support_threads")
      .update({ priority: "alta", status: "open" })
      .eq("id", data.threadId);

    await supabaseAdmin.from("support_messages").insert({
      thread_id: data.threadId,
      sender_id: thread.user_id,
      is_admin: false,
      is_system: true,
      body:
        `🚨 Atendimento encaminhado para a equipe humana.\n` +
        `Protocolo: ${protocol}\n` +
        (data.reason ? `Motivo: ${data.reason}\n` : "") +
        `Prioridade elevada para ALTA. Um atendente vai assumir esta conversa.`,
    });

    return { ok: true, protocol };
  });
