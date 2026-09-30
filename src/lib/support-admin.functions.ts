import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff } from "@/lib/admin-helpers.server";
import { SUPPORT_CATEGORIES } from "./support-categories";

export const adminSetThreadPriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({
    threadId: z.string().uuid(),
    priority: z.enum(["normal", "alta", "critica"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("support_threads")
      .update({ priority: data.priority })
      .eq("id", data.threadId);
    if (error) throw error;
    return { ok: true };
  });

export const adminUpdateThreadCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({
    threadId: z.string().uuid(),
    category: z.enum(SUPPORT_CATEGORIES as any),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("support_threads")
      .update({ category: data.category })
      .eq("id", data.threadId);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Funde tickets duplicados: quando um mesmo cliente tem mais de um atendimento
 * ativo, todas as mensagens vão para o ticket mais antigo e os demais são
 * encerrados. Corrige a lista de tickets repetidos do mesmo e-mail.
 */
export const adminMergeDuplicateThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("support_threads")
      .select("id, user_id, created_at")
      .neq("status", "closed")
      .order("created_at", { ascending: true });
    if (error) throw error;

    const byUser = new Map<string, string[]>();
    for (const row of rows ?? []) {
      const list = byUser.get(row.user_id) ?? [];
      list.push(row.id);
      byUser.set(row.user_id, list);
    }

    let merged = 0;
    let users = 0;
    for (const [, ids] of byUser) {
      if (ids.length < 2) continue;
      const survivor = ids[0];
      const extras = ids.slice(1);
      const { error: moveErr } = await supabaseAdmin
        .from("support_messages")
        .update({ thread_id: survivor })
        .in("thread_id", extras);
      if (moveErr) throw moveErr;
      const { error: closeErr } = await supabaseAdmin
        .from("support_threads")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          unread_by_staff: 0,
          unread_by_customer: 0,
        })
        .in("id", extras);
      if (closeErr) throw closeErr;
      merged += extras.length;
      users += 1;
    }

    return { ok: true, merged, users };
  });


/**
 * Busca em TODO o histórico de conversas do suporte (inclusive tickets
 * encerrados): procura o termo no assunto do ticket e no corpo das mensagens.
 * Retorna os trechos encontrados para a equipe localizar casos antigos.
 */
export const adminSearchSupportHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({
    query: z.string().trim().min(2).max(120),
    limit: z.number().int().min(1).max(50).default(20),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.query.replace(/[%_,()"]/g, " ").trim();
    const pattern = `%${q}%`;

    // 1) Mensagens que contêm o termo
    const { data: msgs, error: msgErr } = await supabaseAdmin
      .from("support_messages")
      .select("id, thread_id, body, is_admin, is_system, created_at")
      .ilike("body", pattern)
      .order("created_at", { ascending: false })
      .limit(200);
    if (msgErr) throw msgErr;

    // 2) Tickets cujo assunto contém o termo
    const { data: subjThreads, error: subjErr } = await supabaseAdmin
      .from("support_threads")
      .select("id")
      .ilike("subject", pattern)
      .limit(50);
    if (subjErr) throw subjErr;

    const threadIds = Array.from(new Set([
      ...(msgs ?? []).map((m: any) => m.thread_id),
      ...(subjThreads ?? []).map((t: any) => t.id),
    ]));
    if (threadIds.length === 0) return { results: [] };

    const { data: threads, error: thErr } = await supabaseAdmin
      .from("support_threads")
      .select("id, subject, status, category, priority, created_at, updated_at, user_id")
      .in("id", threadIds);
    if (thErr) throw thErr;

    const userIds = Array.from(new Set((threads ?? []).map((t: any) => t.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name")
      .in("id", userIds);
    const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    // Agrupa os trechos por ticket (máx. 3 trechos por ticket)
    const snippetsByThread = new Map<string, any[]>();
    for (const m of (msgs ?? []) as any[]) {
      if (m.is_system) continue;
      const list = snippetsByThread.get(m.thread_id) ?? [];
      if (list.length < 3) {
        const body = String(m.body ?? "");
        const idx = body.toLowerCase().indexOf(q.toLowerCase());
        const start = Math.max(0, idx - 60);
        const snippet = (start > 0 ? "…" : "") + body.slice(start, start + 160) + (start + 160 < body.length ? "…" : "");
        list.push({ id: m.id, snippet, is_admin: m.is_admin === true, created_at: m.created_at });
      }
      snippetsByThread.set(m.thread_id, list);
    }

    const results = (threads ?? [])
      .map((t: any) => ({
        thread_id: t.id,
        subject: t.subject,
        status: t.status,
        category: t.category,
        priority: t.priority,
        updated_at: t.updated_at,
        email: (profileById.get(t.user_id) as any)?.email ?? null,
        display_name: (profileById.get(t.user_id) as any)?.display_name ?? null,
        snippets: snippetsByThread.get(t.id) ?? [],
      }))
      .sort((a: any, b: any) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .slice(0, data.limit);

    return { results };
  });

/** Estatísticas do chat nas últimas 24h: mensagens por hora, resposta média e status. */
export const adminSupportStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 24 * 3600_000);
    const { data, error } = await supabaseAdmin
      .from("support_messages")
      .select("thread_id, is_admin, is_system, created_at, read_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true })
      .limit(5000);
    if (error) throw new Error(`[support_messages] ${error.code ?? ""} ${error.message}`);
    const hourly = Array.from({ length: 24 }, (_, i) => {
      const d = new Date(since.getTime() + (i + 1) * 3600_000);
      return { hour: `${String(d.getHours()).padStart(2, "0")}h`, clientes: 0, equipe: 0 };
    });
    const waiting = new Map<string, number>();
    const deltas: number[] = [];
    const status = { lidas: 0, naoLidasPelaEquipe: 0, naoLidasPeloCliente: 0 };
    for (const m of (data ?? []) as any[]) {
      if (m.is_system) continue;
      const t = new Date(m.created_at).getTime();
      const idx = Math.min(23, Math.floor((t - since.getTime()) / 3600_000));
      if (m.is_admin) hourly[idx].equipe++; else hourly[idx].clientes++;
      if (m.read_at) status.lidas++;
      else if (m.is_admin) status.naoLidasPeloCliente++;
      else status.naoLidasPelaEquipe++;
      if (m.is_admin) {
        const s = waiting.get(m.thread_id);
        if (s !== undefined) { deltas.push(t - s); waiting.delete(m.thread_id); }
      } else if (!waiting.has(m.thread_id)) waiting.set(m.thread_id, t);
    }
    const avgMinutes = deltas.length ? Math.max(1, Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length / 60000)) : null;
    return { hourly, avgMinutes, answered: deltas.length, waitingNow: waiting.size, status };
  });
