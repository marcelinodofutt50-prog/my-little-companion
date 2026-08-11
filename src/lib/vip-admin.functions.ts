import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertStaff } from "@/lib/admin-helpers.server";

/** Painel VIP: visão geral de tiers, missões VIP e concessões de Bypass Play Protect. */
export const adminGetVipOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: configs }, { data: missions }, { data: grants }, { data: tierRows }] =
      await Promise.all([
        supabaseAdmin.from("vip_configs").select("*"),
        supabaseAdmin.from("loyalty_missions").select("*").order("created_at", { ascending: true }),
        supabaseAdmin
          .from("play_protect_grants")
          .select("id, user_id, license_id, source, granted_at, expires_at")
          .order("granted_at", { ascending: false })
          .limit(50),
        supabaseAdmin.from("profiles").select("vip_tier"),
      ]);

    const distribution: Record<string, number> = {};
    for (const row of (tierRows || []) as any[]) {
      const t = row.vip_tier || "none";
      distribution[t] = (distribution[t] || 0) + 1;
    }

    const grantUserIds = Array.from(new Set((grants || []).map((g: any) => g.user_id)));
    let emails = new Map<string, string>();
    if (grantUserIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .in("id", grantUserIds);
      emails = new Map((profs || []).map((p: any) => [p.id, p.email]));
    }

    const now = Date.now();
    return {
      configs: (configs || []) as any[],
      missions: ((missions || []) as any[]).map((m) => ({
        ...m,
        minVipTier: (m.requirements as any)?.min_vip_tier || null,
      })),
      grants: ((grants || []) as any[]).map((g) => ({
        ...g,
        email: emails.get(g.user_id) || "—",
        active: new Date(g.expires_at).getTime() > now,
      })),
      distribution,
      totals: {
        members: (tierRows || []).length,
        vips: (tierRows || []).filter((r: any) => (r.vip_tier || "none") !== "none").length,
        activeGrants: (grants || []).filter(
          (g: any) => new Date(g.expires_at).getTime() > now,
        ).length,
      },
    };
  });

/** Ajusta os requisitos de um tier VIP. */
export const adminUpdateVipConfig = createServerFn({ method: "POST" })
  .validator((i: unknown) =>
    z
      .object({
        tier: z.enum(["bronze", "silver", "gold", "diamond", "elite", "vip"]),
        min_loyalty_points: z.number().int().min(0),
        min_months_active: z.number().int().min(0),
        min_conversions: z.number().int().min(0),
        min_reputation: z.number().int().min(0).max(100),
      })
      .parse(i),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("vip_configs")
      .upsert(data as any, { onConflict: "tier" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Cria ou edita uma missão (VIP ou padrão). */
export const adminUpsertMission = createServerFn({ method: "POST" })
  .validator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(3).max(80),
        description: z.string().trim().max(300).optional(),
        difficulty: z.enum(["easy", "medium", "hard"]).default("easy"),
        reward_points: z.number().int().min(0).max(10000),
        status: z.enum(["active", "inactive"]).default("active"),
        requirement_type: z.enum([
          "profile_setup",
          "trial_generation",
          "tutorial_completion",
          "referral",
          "conversion",
          "purchase",
          "community_message",
          "loyalty_points",
          "days_active",
        ]),
        requirement_count: z.number().int().min(1).max(100000).default(1),
        min_vip_tier: z
          .enum(["none", "bronze", "silver", "gold", "diamond", "elite"])
          .default("none"),
      })
      .parse(i),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const requirements: Record<string, unknown> = {
      type: data.requirement_type,
      count: data.requirement_count,
    };
    if (data.min_vip_tier !== "none") requirements['min_vip_tier'] = data.min_vip_tier;

    const payload: any = {
      title: data.title,
      description: data.description || null,
      difficulty: data.difficulty,
      reward_points: data.reward_points,
      status: data.status,
      requirements,
    };
    if (data.id) payload.id = data.id;

    const { error } = await supabaseAdmin
      .from("loyalty_missions")
      .upsert(payload, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Ativa/desativa uma missão. */
export const adminToggleMission = createServerFn({ method: "POST" })
  .validator((i: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "inactive"]) }).parse(i),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("loyalty_missions")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Concede manualmente dias de Bypass Play Protect a um cliente. */
export const adminGrantPlayProtect = createServerFn({ method: "POST" })
  .validator((i: unknown) =>
    z.object({ email: z.string().email(), days: z.number().int().min(1).max(365) }).parse(i),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email.toLowerCase().trim())
      .maybeSingle();
    if (!profile) throw new Error("Cliente não encontrado.");

    const expires = new Date(Date.now() + data.days * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin.from("play_protect_grants").insert({
      user_id: profile.id,
      license_id: null,
      source: "admin_manual",
      granted_at: new Date().toISOString(),
      expires_at: expires,
    });
    if (error) throw new Error(error.message);
    return { ok: true, expires_at: expires };
  });

/** Recalcula o tier VIP de todos os membros. */
export const adminRecalcAllVipTiers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id");
    let updated = 0;
    for (const p of (profiles || []) as any[]) {
      const { error } = await supabaseAdmin.rpc("recalc_vip_tier", { _user_id: p.id });
      if (!error) updated++;
    }
    return { ok: true, updated };
  });
