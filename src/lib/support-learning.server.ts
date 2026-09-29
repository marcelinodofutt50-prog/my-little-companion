import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildKnowledgeEntry, type ThreadMsg } from "./support-learning";

/** Acima dessa semelhança consideramos o mesmo caso (evita respostas duplicadas). */
const DUPLICATE_RANK = 0.5;

/** Grava como conhecimento a resposta que a equipe acabou de dar ao cliente. */
export async function learnFromStaffReply(threadId: string, staffId: string, reply: string, replyId?: string | null) {
  try {
    const { data } = await supabaseAdmin
      .from("support_messages")
      .select("id, body, is_admin, is_system")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(15);
    const history = ((data ?? []) as (ThreadMsg & { id: string })[])
      .filter((m) => m.id !== replyId)
      .reverse();
    const entry = buildKnowledgeEntry(history, reply);
    if (!entry) return { learned: false };

    const kb = (supabaseAdmin as any).from("support_knowledge");
    // Mesma pergunta nesta conversa: a resposta mais nova substitui a anterior.
    const { data: existing } = await kb
      .select("id")
      .eq("source_thread_id", threadId)
      .eq("question", entry.question)
      .maybeSingle();
    let targetId: string | null = existing?.id ?? null;

    // Caso quase idêntico já aprendido em outra conversa: atualiza em vez de duplicar,
    // assim a memória fica limpa e sempre com a solução mais recente da equipe.
    if (!targetId) {
      const { data: similar } = await (supabaseAdmin as any).rpc("match_support_knowledge", { _q: entry.question, _limit: 1 });
      const top = (similar ?? [])[0] as { id: string; rank: number } | undefined;
      if (top && top.rank >= DUPLICATE_RANK) targetId = top.id;
    }

    if (targetId) {
      const { error: upErr } = await (supabaseAdmin as any).from("support_knowledge")
        .update({ answer: entry.answer, created_by: staffId, status: "active", updated_at: new Date().toISOString() })
        .eq("id", targetId);
      if (upErr) console.error("[support-learning] falha ao atualizar:", upErr.message);
      return { learned: !upErr, updated: true };
    }
    const { error } = await (supabaseAdmin as any).from("support_knowledge").insert({
      ...entry,
      source_thread_id: threadId,
      created_by: staffId,
    });
    if (error) console.error("[support-learning] falha ao gravar:", error.message);
    return { learned: !error };
  } catch (e) {
    console.error("[support-learning] erro:", e);
    return { learned: false };
  }
}

/** Busca casos parecidos já resolvidos. Nunca derruba o atendimento. */
export async function findKnowledge(message: string, limit = 3) {
  try {
    const { data, error } = await (supabaseAdmin as any).rpc("match_support_knowledge", { _q: message, _limit: limit });
    if (error) {
      console.error("[support-learning] busca falhou:", error.message);
      return [];
    }
    const rows = ((data ?? []) as { id: string; question: string; answer: string; rank: number }[])
      .filter((r) => r.rank >= 0.1);
    if (rows.length) {
      for (const r of rows) {
        const { data: cur } = await (supabaseAdmin as any).from("support_knowledge").select("uses").eq("id", r.id).maybeSingle();
        await (supabaseAdmin as any).from("support_knowledge")
          .update({ uses: (cur?.uses ?? 0) + 1, last_used_at: new Date().toISOString() })
          .eq("id", r.id);
      }
    }
    return rows;
  } catch (e) {
    console.error("[support-learning] busca erro:", e);
    return [];
  }
}
