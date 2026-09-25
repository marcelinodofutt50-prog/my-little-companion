import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Registra o aceite do aviso do teste grátis (prova com data e aparelho). */
export const acceptTrialTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) =>
    z
      .object({ deviceId: z.string().trim().max(120).optional(), attrs: z.string().trim().max(600).optional() })
      .partial()
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { requireNotBanned } = await import("./ban-engine.server");
    await requireNotBanned(context.userId, "O teste grátis");
    const { collectSignals } = await import("./fraud-engine.server");
    const sig = await collectSignals(data ?? null);
    const { TRIAL_TERMS_VERSION } = await import("./ban-rules");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("trial_consents")
      .insert({ user_id: context.userId, device_hash: sig.deviceHash, ip_hash: sig.ipHash, terms_version: TRIAL_TERMS_VERSION })
      .select("id")
      .single();
    if (error || !row) throw new Error("Não foi possível registrar o aceite. Tente novamente.");
    return { consentId: row.id as string };
  });

/** Situação de banimento do próprio usuário (para a faixa e os preços). */
export const getMyBanStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("account_bans")
      .select("reason, price_multiplier, created_at")
      .eq("user_id", context.userId)
      .is("revoked_at", null)
      .maybeSingle();
    return {
      banned: !!data,
      reason: (data?.reason as string) ?? null,
      priceMultiplier: data ? Number(data.price_multiplier) : 1,
      since: (data?.created_at as string) ?? null,
    };
  });

async function requireAdmin(context: any) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Apenas administradores.");
}

export const adminListBans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: bans } = await db
      .from("account_bans")
      .select("id, user_id, reason, source, price_multiplier, linked_group_id, evidence, created_at, revoked_at")
      .order("created_at", { ascending: false })
      .range(0, 199);
    const ids = [...new Set((bans ?? []).map((b: any) => b.user_id))];
    const { data: profs } = ids.length
      ? await db.from("profiles").select("id, email, display_name").in("id", ids)
      : { data: [] };
    const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return (bans ?? []).map((b: any) => ({
      ...b,
      email: (byId.get(b.user_id) as any)?.email ?? null,
      name: (byId.get(b.user_id) as any)?.display_name ?? null,
    }));
  });

export const adminBanUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: any) =>
    z.object({ email: z.string().trim().email().max(255), reason: z.string().trim().min(3).max(300), multiplier: z.number().min(1).max(5).default(1.5) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: prof } = await db.from("profiles").select("id").ilike("email", data.email).maybeSingle();
    if (!prof) throw new Error("Conta não encontrada.");
    const { error } = await db.from("account_bans").upsert(
      { user_id: prof.id, reason: data.reason, source: "manual", price_multiplier: data.multiplier, created_by: context.userId, revoked_at: null, revoked_by: null, created_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    const { data: dev } = await db.from("device_identities").select("device_hash").eq("user_id", prof.id).not("device_hash", "is", null).limit(10);
    const { data: ban } = await db.from("account_bans").select("id").eq("user_id", prof.id).single();
    const fps = (dev ?? []).map((d: any) => ({ ban_id: ban.id, kind: "device", value: d.device_hash }));
    if (fps.length) await db.from("ban_fingerprints").upsert(fps, { onConflict: "kind,value,ban_id", ignoreDuplicates: true });
    await db.from("audit_logs").insert({ user_id: context.userId, action: "ban_user", details: { target: prof.id, reason: data.reason } } as any).then(() => {}, () => {});
    return { ok: true };
  });

export const adminUnbanUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: any) => z.object({ banId: z.string().uuid(), includeLinked: z.boolean().default(false) }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: ban } = await db.from("account_bans").select("id, linked_group_id").eq("id", data.banId).maybeSingle();
    if (!ban) throw new Error("Banimento não encontrado.");
    const patch = { revoked_at: new Date().toISOString(), revoked_by: context.userId };
    if (data.includeLinked && ban.linked_group_id) {
      await db.from("account_bans").update(patch).eq("linked_group_id", ban.linked_group_id);
    } else {
      await db.from("account_bans").update(patch).eq("id", ban.id);
    }
    await db.from("audit_logs").insert({ user_id: context.userId, action: "unban_user", details: { ban_id: ban.id, include_linked: data.includeLinked } } as any).then(() => {}, () => {});
    return { ok: true };
  });

export const adminSetBanMultiplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: any) => z.object({ banId: z.string().uuid(), multiplier: z.number().min(1).max(5) }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("account_bans").update({ price_multiplier: data.multiplier }).eq("id", data.banId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
