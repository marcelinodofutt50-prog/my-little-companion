import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FeedbackItem = {
  id: string;
  category: string;
  message: string;
  rating: number | null;
  is_anonymous: boolean;
  status: string;
  admin_note: string | null;
  created_at: string;
};

export const CATEGORIES = ["melhoria", "critica", "bug", "elogio"] as const;

/** Envia sugestão/crítica. Se anônimo, o vínculo com o usuário não é gravado. */
export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        category: z.enum(CATEGORIES),
        message: z.string().trim().min(10, "Escreva pelo menos 10 caracteres.").max(1500),
        rating: z.number().int().min(1).max(5).optional(),
        anonymous: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("product_feedback").insert({
      user_id: data.anonymous ? null : context.userId,
      category: data.category,
      message: data.message,
      rating: data.rating ?? null,
      is_anonymous: data.anonymous,
    } as any);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

/** Histórico do próprio usuário (só aparece o que ele enviou identificado). */
export const listMyFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FeedbackItem[]> => {
    const { data } = await context.supabase
      .from("product_feedback")
      .select("id, category, message, rating, is_anonymous, status, admin_note, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as FeedbackItem[];
  });

export type AdminFeedbackItem = FeedbackItem & {
  user_email: string | null;
  user_name: string | null;
};

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  const { data: isMod } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "moderator",
  });
  if (!isAdmin && !isMod) throw new Error("Acesso restrito à equipe.");
  return Boolean(isAdmin);
}

/** Lista todos os feedbacks para a equipe (anônimos ficam sem identificação). */
export const adminListFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        status: z.enum(["all", "new", "reviewed", "done"]).default("all"),
        category: z.enum(["all", ...CATEGORIES]).default("all"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AdminFeedbackItem[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("product_feedback")
      .select("id, user_id, category, message, rating, is_anonymous, status, admin_note, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.category !== "all") q = q.eq("category", data.category);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(
      new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean)),
    ) as string[];
    const nameById = new Map<string, { email: string | null; name: string | null }>();
    if (ids.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name")
        .in("id", ids);
      for (const p of (profiles ?? []) as any[]) {
        nameById.set(p.id, { email: p.email ?? null, name: p.full_name ?? null });
      }
    }

    return (rows ?? []).map((r: any) => {
      const p = r.user_id ? nameById.get(r.user_id) : undefined;
      return {
        id: r.id,
        category: r.category,
        message: r.message,
        rating: r.rating,
        is_anonymous: r.is_anonymous,
        status: r.status,
        admin_note: r.admin_note,
        created_at: r.created_at,
        user_email: r.is_anonymous ? null : (p?.email ?? null),
        user_name: r.is_anonymous ? null : (p?.name ?? null),
      };
    });
  });

/** Atualiza status e resposta da equipe em um feedback. */
export const adminUpdateFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "reviewed", "done"]).optional(),
        admin_note: z.string().trim().max(1500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.status) patch['status'] = data.status;
    if (data.admin_note !== undefined) patch['admin_note'] = data.admin_note || null;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await supabaseAdmin.from("product_feedback").update(patch as any).eq("id", data.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

