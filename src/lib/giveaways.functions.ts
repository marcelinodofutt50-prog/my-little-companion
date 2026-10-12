import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publicGiveawayLabel as publicLabel, randomIndex, shuffledSample } from "./giveaway-random";

async function adminDb(context: any) {
  const { assertAdmin } = await import("@/lib/admin-helpers.server");
  await assertAdmin(context);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const adminListGiveaways = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context);
    const { data, error } = await db
      .from("site_giveaways")
      .select("id,title,prize,description,min_account_days,require_nickname,require_avatar,require_paid,status,winner_label,eligible_count,drawn_at,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    const withCounts = await Promise.all(
      rows.map(async (g) => {
        if (g.status !== "open") return g;
        const { data: el, error: countError } = await db.rpc("giveaway_eligible_users", { _id: g.id });
        if (countError) throw new Error("Não foi possível conferir os participantes. Atualize e tente novamente.");
        return { ...g, eligible_count: (el ?? []).length };
      }),
    );
    return withCounts;
  });

export const adminCreateGiveaway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({
      title: z.string().trim().min(3).max(100),
      prize: z.string().trim().min(2).max(120),
      description: z.string().trim().max(800).optional(),
      min_account_days: z.number().int().min(0).max(365),
      require_nickname: z.boolean(),
      require_avatar: z.boolean(),
      require_paid: z.boolean(),
      announce: z.boolean(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    let announcement_id: string | null = null;
    if (data.announce) {
      const rules = [
        `Conta criada há pelo menos ${data.min_account_days} dia(s)`,
        data.require_nickname ? "Apelido próprio definido no perfil" : null,
        data.require_avatar ? "Foto de perfil" : null,
        data.require_paid ? "Ter um plano pago" : null,
        "E-mail confirmado e conta sem bloqueios",
      ].filter(Boolean);
      const body = `${data.description ? data.description + "\n\n" : ""}Prêmio: ${data.prize}\n\nRegras para participar:\n• ${rules.join("\n• ")}\n\nTodos que cumprirem as regras já estão participando automaticamente.`;
       const { data: ann, error: announcementError } = await db
        .from("announcements")
        .insert({ title: `🎁 Sorteio: ${data.title}`, body, severity: "info", status: "published", is_active: true, created_by: context.userId, tags: ["sorteio"] })
        .select("id")
        .single();
      announcement_id = ann?.id ?? null;
       if (announcementError || !announcement_id) throw new Error("Não foi possível publicar o anúncio; o sorteio não foi criado.");
    }
    const { announce: _a, ...rest } = data;
    const { data: row, error } = await db
      .from("site_giveaways")
      .insert({ ...rest, announcement_id, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

/** Sorteia um vencedor aleatório entre os elegíveis. Retorna nomes para a roleta. */
export const adminDrawGiveaway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    const { data: g } = await db.from("site_giveaways").select("id,status,prize").eq("id", data.id).maybeSingle();
    if (!g) throw new Error("Sorteio não encontrado.");
    if (g.status !== "open") throw new Error("Este sorteio já foi realizado.");
    const { data: el, error } = await db.rpc("giveaway_eligible_users", { _id: data.id });
    if (error) throw new Error(error.message);
    const list = (el ?? []) as { user_id: string; label: string | null }[];
    if (!list.length) throw new Error("Ninguém cumpre as regras ainda.");
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const winner = list[buf[0] % list.length];
    const label = publicLabel(winner.label);
    const { data: upd, error: uerr } = await db
      .from("site_giveaways")
      .update({ status: "drawn", winner_user_id: winner.user_id, winner_label: label, eligible_count: list.length, drawn_by: context.userId, drawn_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "open")
      .select("id");
    if (uerr) throw new Error(uerr.message);
    if (!upd?.length) throw new Error("Este sorteio já foi realizado.");
    const pool = list.slice().sort(() => Math.random() - 0.5).slice(0, 40).map((u) => publicLabel(u.label));
    return { winner: label, eligible: list.length, pool, prize: g.prize };
  });

export const adminCancelGiveaway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    await db.from("site_giveaways").update({ status: "cancelled" }).eq("id", data.id).eq("status", "open");
    return { ok: true };
  });
