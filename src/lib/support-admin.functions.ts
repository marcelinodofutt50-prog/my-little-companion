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

