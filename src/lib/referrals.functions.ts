import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publicUserLabel } from "@/lib/privacy";

export const getMyReferralInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Perfil e Stats
    const { data: profile } = await supabase
      .from("profiles")
      .select("referral_code, referral_reward_pref, pix_key, reward_points, current_level, trust_score, referrals_valid_count, conversions_count, referred_by")
      .eq("id", userId)
      .maybeSingle();

    const { data: referralCode } = await supabase
      .from("referral_codes")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // 2. Indicações e Labels
    const { data: referrals } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false });

    const rows = (referrals ?? []) as any[];
    const referredIds = rows.map((r) => r.referred_id);
    
    let labelMap: Record<string, string> = {};
    if (referredIds.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profs } = await supabaseAdmin
        .from("profiles").select("id, email, display_name").in("id", referredIds);
      labelMap = Object.fromEntries(
        (profs ?? []).map((p: any) => [p.id, publicUserLabel(p.display_name, p.email)]),
      );
    }

    // 3. Níveis e Progressão
    const { data: levels } = await supabase
      .from("reward_level_config")
      .select("*")
      .order("min_conversions", { ascending: true });

    const currentLevel = (levels ?? []).find(l => l.level === (profile?.current_level || 'novato')) || (levels ?? [])[0];
    const nextLevel = (levels ?? []).find(l => l.min_conversions > (profile?.conversions_count || 0));

    // 4. Recompensas e Missões
    const { data: userRewards } = await supabase
      .from("user_rewards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const { data: missions } = await supabase
      .from("reward_missions")
      .select("*")
      .eq("active", true)
      .order("priority", { ascending: false });

    const { data: missionProgress } = await supabase
      .from("user_mission_progress")
      .select("*")
      .eq("user_id", userId);

    const { data: communityGoals } = await supabase
      .from("promotions")
      .select("*")
      .eq("promo_type", "community_goal")
      .eq("active", true);

    return {
      code: referralCode?.code ?? profile?.referral_code ?? null,
      pref: (profile?.referral_reward_pref as "cashback" | "free_month" | "pix") ?? "cashback",
      pixKey: (profile?.pix_key as string) ?? null,
      referrals: rows.map((r) => ({ ...r, referred_label: labelMap[r.referred_id] ?? "Membro Shadow" })),
      rewards: userRewards || [],
      stats: { 
        total: rows.length, 
        granted: profile?.referrals_valid_count || 0, 
        conversions: profile?.conversions_count || 0,
        points: profile?.reward_points || 0,
        trust: profile?.trust_score || 100
      },
      level: currentLevel,
      nextLevel: nextLevel,
      missions: (missions ?? []).map(m => ({
        ...m,
        progress: (missionProgress ?? []).find(p => p.mission_id === m.id) || null
      })),
      communityGoals: communityGoals || [],
      referredBy: profile?.referred_by || null
    };
  });

export const updateReferralPref = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({
      pref: z.enum(["cashback", "free_month", "pix"]),
      pixKey: z.string().trim().max(120).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        referral_reward_pref: data.pref,
        pix_key: data.pref === "pix" ? (data.pixKey || null) : null,
      } as any)
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const activateTrialReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { internalGenerateTrial } = await import("./license.server");
    const { evaluateTrial } = await import("./trial-guard.server");

    // 1. Verifica se já tem uma licença ou trial ativo
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("referred_by, metadata")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.referred_by) {
      throw new Error("Este benefício é exclusivo para membros convidados.");
    }

    const metadata = (profile.metadata as any) || {};
    if (metadata.welcome_trial_claimed) {
      throw new Error("Você já resgatou seu benefício de boas-vindas.");
    }

    const guard = await evaluateTrial({ userId });
    if (!guard.allowed) {
      throw new Error(guard.reason ?? "Não foi possível validar este benefício.");
    }

    // 2. Gera o Trial de 3 dias
    try {
      const trial = await internalGenerateTrial(supabaseAdmin, userId, 3, guard.ipHash);
      
      // Marca como resgatado
      await supabaseAdmin
        .from("profiles")
        .update({
          metadata: { ...metadata, welcome_trial_claimed: true }
        } as any)
        .eq("id", userId);

      // Registra o evento de indicação
      const { data: referral } = await supabaseAdmin
        .from("referrals")
        .select("id")
        .eq("referred_id", userId)
        .maybeSingle();

      if (referral) {
        await supabaseAdmin.from("referral_events").insert({
          referral_id: referral.id,
          event_type: 'trial_active',
          metadata: { trial_id: trial.id }
        });

        await supabaseAdmin
          .from("referrals")
          .update({ status: 'trial_active' } as any)
          .eq("id", referral.id);
      }

      return { ok: true, trial };
    } catch (err: any) {
      throw new Error(err.message || "Erro ao ativar trial.");
    }
  });

export const validateReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ code: z.string().trim().min(4).max(16) }).parse(i))
  .handler(async ({ data, context }) => {
    const code = data.code.toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("id, display_name").eq("referral_code", code).maybeSingle();
    if (!prof || prof.id === context.userId) return { valid: false };
    return { valid: true, referrerName: (prof as any).display_name || "Membro Shadow" };
  });
