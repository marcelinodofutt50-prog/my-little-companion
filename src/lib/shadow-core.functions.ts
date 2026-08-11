import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getShadowPassData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context.userId) throw new Error("Unauthorized");

    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Core Profile (Identity + Reputation + VIP Tier)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, full_name, created_at, vip_tier, reputation_score, conversions_count, referrals_valid_count, metadata, reward_points")
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
    const currentLoyaltyTier = tierList.find(t => t.tier === (loyalty?.current_tier || 'starter'));
    const nextLoyaltyTier = tierList.find(t => t.priority === (currentLoyaltyTier?.priority ?? -1) + 1);

    // 3. VIP Status & Benefits
    // New tiers: BRONZE, SILVER, GOLD, DIAMOND, ELITE
    const vipTierList = ['none', 'bronze', 'silver', 'gold', 'diamond', 'elite'];
    const currentVipTier = profileData.vip_tier || 'none';
    const nextVipTier = vipTierList[vipTierList.indexOf(currentVipTier) + 1] || 'elite';

    // 4. Missions
    const { data: missions } = await supabaseAdmin
      .from("loyalty_missions")
      .select("*")
      .eq("status", "active");

    const { data: userMissions } = await supabaseAdmin
      .from("user_missions")
      .select("*")
      .eq("user_id", userId);

    const missionsWithProgress = (missions || []).map(m => {
      const um = (userMissions || []).find(u => u.mission_id === m.id);
      return { ...m, ...um, completed: !!um?.completed_at };
    });

    // 5. Community Goals
    const { data: goals } = await supabaseAdmin
      .from("community_goals")
      .select("*")
      .order("target_members", { ascending: true });

    const { data: activeMembers } = await supabaseAdmin
      .from("profiles")
      .select("count", { count: 'exact', head: true });
      
    const currentMemberCount = (activeMembers as any)?.count || 0;

    // 6. Staff Eligibility
    const monthsActive = profileData.created_at 
      ? Math.floor((new Date().getTime() - new Date(profileData.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : 0;
      
    const isStaffEligible = 
        (currentLoyaltyTier?.priority || 0) >= 2 &&
        (profileData.reputation_score || 0) >= 90 &&
        monthsActive >= 6 &&
        (profileData.conversions_count || 0) >= 10;

    // 7. Benefits based on tier
    const getBenefits = (tier: string) => {
      const base = ["Acesso ao Dashboard", "Comunidade Nexus"];
      if (tier === 'bronze') return [...base, "Suporte Padrão"];
      if (tier === 'silver') return [...base, "Suporte Prioritário", "Descontos 5%"];
      if (tier === 'gold') return [...base, "Suporte Prioritário", "Descontos 10%", "Play Protect Trial (1 Dia)"];
      if (tier === 'diamond') return [...base, "Suporte VIP", "Descontos 15%", "Play Protect Trial (1 Dia)", "Nexus Chat Staff"];
      if (tier === 'elite') return [...base, "Suporte Direto (WhatsApp)", "Descontos 25%", "Play Protect Ilimitado", "Marketplace Exclusivo"];
      return base;
    };

    return {
      identity: {
        id: userId,
        nickname: profileData.display_name || profileData.full_name || profileData.email?.split('@')[0],
        avatar: (profileData.metadata as any)?.avatar_url || null,
        joinedAt: profileData.created_at || new Date().toISOString(),
        metadata: profileData.metadata,
        reward_points: profileData.reward_points || 0
      },
      loyalty: {
        points: loyalty?.points || 0,
        tier: currentLoyaltyTier?.name || 'Starter',
        daysActive: loyalty?.days_active || 0,
        progress: nextLoyaltyTier ? Math.min(100, (loyalty?.points || 0) / nextLoyaltyTier.min_points * 100) : 100,
        nextTier: nextLoyaltyTier?.name
      },
      missions: missionsWithProgress,
      community: {
        referrals: profileData.referrals_valid_count || 0,
        conversions: profileData.conversions_count || 0,
        memberCount: currentMemberCount,
        goals: goals || []
      },
      vip: {
        tier: currentVipTier,
        next: { tier: nextVipTier },
        benefits: getBenefits(currentVipTier)
      },
      reputation: {
        score: profileData.reputation_score || 100
      },
      staff: {
        isEligible: isStaffEligible,
        criteria: {
          loyalty: (currentLoyaltyTier?.priority || 0) >= 2,
          reputation: (profileData.reputation_score || 0) >= 90,
          seniority: monthsActive >= 6,
          conversions: (profileData.conversions_count || 0) >= 10
        }
      }
    };
  });

export const updateVipStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: profile } = await supabaseAdmin.from("profiles").select("conversions_count").eq("id", userId).single();
    
    type VipTier = 'none' | 'vip' | 'bronze' | 'silver' | 'gold' | 'diamond' | 'elite';
    let newTier: VipTier = 'bronze';
    const c = profile?.conversions_count || 0;
    
    if (c >= 50) newTier = 'elite';
    else if (c >= 25) newTier = 'diamond';
    else if (c >= 10) newTier = 'gold';
    else if (c >= 5) newTier = 'silver';
    
    await supabaseAdmin.from("profiles").update({ vip_tier: newTier }).eq("id", userId);
    return { tier: newTier };
  });
