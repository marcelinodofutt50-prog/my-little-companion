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
    await db.from("audit_logs").insert({ user_id: context.userId, system: "bans", event: "ban_user", metadata: { target: prof.id, reason: data.reason } } as any).then(() => {}, () => {});
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
    await db.from("audit_logs").insert({ user_id: context.userId, system: "bans", event: "unban_user", metadata: { ban_id: ban.id, include_linked: data.includeLinked } } as any).then(() => {}, () => {});
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

async function requireStaffCtx(context: any) {
  const { data } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (!data) throw new Error("Apenas equipe.");
}

/** Mensagens bloqueadas pelo filtro da Comunidade. */
export const adminListBlockedMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaffCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: rows } = await db
      .from("community_strikes")
      .select("id, user_id, reason, content, created_at")
      .order("created_at", { ascending: false })
      .range(0, 199);
    const ids = [...new Set((rows ?? []).map((r: any) => r.user_id))];
    const { data: profs } = ids.length ? await db.from("profiles").select("id, email, display_name").in("id", ids) : { data: [] };
    const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return (rows ?? []).map((r: any) => ({ ...r, email: (byId.get(r.user_id) as any)?.email ?? null, name: (byId.get(r.user_id) as any)?.display_name ?? null }));
  });

/** Libera (publica na Comunidade e remove a infração) ou apaga a mensagem bloqueada. */
export const adminResolveBlockedMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: any) => z.object({ id: z.string().uuid(), action: z.enum(["release", "delete"]) }).parse(i))
  .handler(async ({ data, context }) => {
    await requireStaffCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: row } = await db.from("community_strikes").select("id, user_id, content").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Mensagem não encontrada.");
    if (data.action === "release" && row.content) {
      const { error } = await db.from("community_messages").insert({ user_id: row.user_id, content: row.content });
      if (error) throw new Error(error.message);
    }
    await db.from("community_strikes").delete().eq("id", row.id);
    await db.from("audit_logs").insert({ user_id: context.userId, system: "bans", event: `community_${data.action}`, metadata: { strike_id: row.id, target: row.user_id } } as any).then(() => {}, () => {});
    return { ok: true };
  });

/** Detalhe do cliente bloqueado: contas ligadas, infrações e bloqueios de teste. */
export const adminBanDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i: any) => z.object({ banId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: ban } = await db.from("account_bans").select("*").eq("id", data.banId).maybeSingle();
    if (!ban) throw new Error("Banimento não encontrado.");
    let linkedIds: string[] = Array.isArray(ban.evidence?.linked_accounts) ? ban.evidence.linked_accounts : [];
    if (ban.linked_group_id) {
      const { data: grp } = await db.from("account_bans").select("user_id").eq("linked_group_id", ban.linked_group_id);
      linkedIds = [...new Set([...linkedIds, ...(grp ?? []).map((g: any) => g.user_id)])];
    }
    const { data: devs } = await db.from("device_identities").select("device_hash").eq("user_id", ban.user_id).not("device_hash", "is", null).limit(10);
    const hashes = (devs ?? []).map((d: any) => d.device_hash);
    if (hashes.length) {
      const { data: same } = await db.from("device_identities").select("user_id").in("device_hash", hashes).limit(50);
      linkedIds = [...new Set([...linkedIds, ...(same ?? []).map((s: any) => s.user_id)])];
    }
    linkedIds = linkedIds.filter((id) => id && id !== ban.user_id);
    const { data: linked } = linkedIds.length
      ? await db.from("profiles").select("id, email, created_at").in("id", linkedIds)
      : { data: [] };
    const { data: strikes } = await db.from("community_strikes").select("reason, content, created_at").eq("user_id", ban.user_id).order("created_at", { ascending: false }).limit(50);
    const { data: frauds } = await db.from("fraud_assessments").select("action, decision, score, reasons, created_at").eq("user_id", ban.user_id).order("created_at", { ascending: false }).limit(30);
    const { data: blocks } = await db.from("trial_blocks").select("reason, created_at").eq("user_id", ban.user_id).order("created_at", { ascending: false }).limit(30);
    const history = [
      ...(strikes ?? []).map((s: any) => ({ at: s.created_at, kind: "Comunidade", detail: `${s.reason}: ${s.content ?? ""}` })),
      ...(frauds ?? []).filter((f: any) => String(f.decision).toLowerCase() === "deny").map((f: any) => ({ at: f.created_at, kind: "Antifraude", detail: `${f.action} · ${(f.reasons ?? []).join?.(", ") ?? ""}` })),
      ...(blocks ?? []).map((b: any) => ({ at: b.created_at, kind: "Teste bloqueado", detail: b.reason })),
      { at: ban.created_at, kind: "Banimento", detail: ban.reason },
    ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return { linked: linked ?? [], history, devices: hashes.length };
  });
