import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getShadowPassData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context.userId) throw new Error("Unauthorized");

    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 0. Recalcula o tier VIP com base em compras/indicações reais
    try {
      await supabaseAdmin.rpc("recalc_vip_tier", { _user_id: userId });
    } catch (e) {
      console.warn("[ShadowPass] recalc_vip_tier indisponível:", (e as any)?.message);
    }

    // 1. Core Profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, email, display_name, full_name, created_at, vip_tier, reputation_score, conversions_count, referrals_valid_count, metadata, reward_points, avatar_url",
      )
      .eq("id", userId)
      .maybeSingle();

    const profileData: any = profile || {};

    // 2. Loyalty & Tiers
    const { data: loyalty } = await supabaseAdmin
      .from("user_loyalty")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: tiers } = await supabaseAdmin
      .from("loyalty_tier_config")
      .select("*")
      .order("priority", { ascending: true });

    const tierList = (tiers || []) as any[];
    const currentLoyaltyTier = tierList.find(
      (t) => t.tier === (loyalty?.current_tier || "starter"),
    );
    const nextLoyaltyTier = tierList.find(
      (t) => t.priority === (currentLoyaltyTier?.priority ?? -1) + 1,
    );

    // 3. VIP
    const vipTierList = ["none", "bronze", "silver", "gold", "diamond", "elite"];
    const currentVipTier = profileData.vip_tier || "none";
    const vipIndex = Math.max(0, vipTierList.indexOf(currentVipTier));
    const nextVipTier = vipTierList[vipIndex + 1] || null;
    const vipProgress = Math.round((vipIndex / (vipTierList.length - 1)) * 100);

    // 4. Missões com progresso real (normais + exclusivas VIP)
    const { loadMissionMetrics, missionProgress, vipRank } = await import(
      "@/lib/mission-progress.server"
    );

    const { data: missions } = await supabaseAdmin
      .from("loyalty_missions")
      .select("*")
      .eq("status", "active");

    const { data: userMissions } = await supabaseAdmin
      .from("user_missions")
      .select("*")
      .eq("user_id", userId);

    const metrics = await loadMissionMetrics(supabaseAdmin, userId);
    const meta = (profileData.metadata as any) || {};

    const allMissions = (missions || []).map((m: any) => {
      const um = (userMissions || []).find((u: any) => u.mission_id === m.id);
      const completed = !!um?.completed_at;
      const req = (m.requirements as any) || {};
      const minVip = req.min_vip_tier || null;
      return {
        ...m,
        ...um,
        id: m.id,
        completed,
        vipOnly: !!minVip,
        minVipTier: minVip,
        locked: !!minVip && vipRank(metrics.vipTier) < vipRank(minVip),
        progress: completed ? 100 : missionProgress(req, metrics),
      };
    });

    const missionsWithProgress = allMissions.filter((m: any) => !m.vipOnly);
    const vipMissions = allMissions.filter((m: any) => m.vipOnly);


    // 5. Community Goals
    const { data: goals } = await supabaseAdmin
      .from("community_goals")
      .select("*")
      .order("target_members", { ascending: true });

    const { count: memberCount } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });

    const currentMemberCount = memberCount || 0;

    const goalsWithState = (goals || []).map((g: any) => ({
      ...g,
      achieved_at:
        g.achieved_at ||
        (currentMemberCount >= g.target_members ? new Date().toISOString() : null),
      progress: Math.min(
        100,
        Math.round((currentMemberCount / (g.target_members || 1)) * 100),
      ),
    }));

    // 6. Staff Eligibility
    const monthsActive = profileData.created_at
      ? Math.floor(
          (new Date().getTime() - new Date(profileData.created_at).getTime()) /
            (1000 * 60 * 60 * 24 * 30),
        )
      : 0;

    const isStaffEligible =
      (currentLoyaltyTier?.priority || 0) >= 2 &&
      (profileData.reputation_score || 0) >= 90 &&
      monthsActive >= 6 &&
      (profileData.conversions_count || 0) >= 10;

    // 7. Benefícios por tier VIP
    const getBenefits = (tier: string) => {
      const base = ["Acesso ao Dashboard", "Comunidade Nexus"];
      if (tier === "bronze") return [...base, "Suporte Padrão", "Badge Bronze no Nexus"];
      if (tier === "silver") return [...base, "Suporte Prioritário", "Descontos 5%"];
      if (tier === "gold")
        return [
          ...base,
          "Suporte Prioritário",
          "Descontos 10%",
          "Bypass Play Protect (1 dia grátis/mês)",
        ];
      if (tier === "diamond")
        return [
          ...base,
          "Suporte VIP",
          "Descontos 15%",
          "Bypass Play Protect (1 dia grátis/mês)",
          "Chat Direto com Staff",
        ];
      if (tier === "elite")
        return [
          ...base,
          "Suporte Direto (WhatsApp)",
          "Descontos 25%",
          "Bypass Play Protect Ilimitado",
          "Marketplace Exclusivo",
        ];
      return base;
    };

    return {
      identity: {
        id: userId,
        nickname:
          meta.nickname ||
          profileData.display_name ||
          profileData.full_name ||
          profileData.email?.split("@")[0],
        avatar: meta.avatar_url || profileData.avatar_url || null,
        joinedAt: profileData.created_at || new Date().toISOString(),
        metadata: profileData.metadata,
        reward_points: profileData.reward_points || 0,
        isAnonymous: !!meta.is_anonymous,
      },
      loyalty: {
        points: loyalty?.points || 0,
        tier: currentLoyaltyTier?.name || "Starter",
        daysActive: loyalty?.days_active || 0,
        progress: nextLoyaltyTier
          ? Math.min(
              100,
              ((loyalty?.points || 0) / nextLoyaltyTier.min_points) * 100,
            )
          : 100,
        nextTier: nextLoyaltyTier?.name,
      },
      missions: missionsWithProgress,
      community: {
        referrals: profileData.referrals_valid_count || 0,
        conversions: profileData.conversions_count || 0,
        memberCount: currentMemberCount,
        goals: goalsWithState,
      },
      vip: {
        tier: currentVipTier,
        next: nextVipTier ? { tier: nextVipTier } : null,
        progress: vipProgress,
        benefits: getBenefits(currentVipTier),
      },
      reputation: {
        score: profileData.reputation_score || 100,
      },
      staff: {
        isEligible: isStaffEligible,
        criteria: {
          loyalty: (currentLoyaltyTier?.priority || 0) >= 2,
          reputation: (profileData.reputation_score || 0) >= 90,
          seniority: monthsActive >= 6,
          conversions: (profileData.conversions_count || 0) >= 10,
        },
      },
    };
  });

export const updateVipStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.rpc("recalc_vip_tier", { _user_id: userId });
    return { tier: data as any };
  });
