import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getShadowPassData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Core Profile (Identity + Reputation + VIP Tier)
    const { data: profile } = await (supabase
      .from("profiles")
      .select("id, email, display_name, full_name, created_at, vip_tier, reputation_score, conversions_count, referrals_valid_count, metadata")
      .eq("id", userId)
      .maybeSingle() as any);

    const profileData = profile || {};

    // 2. Loyalty (Reusing loyalty system)
    const { data: loyalty } = await (supabase
      .from("user_loyalty" as any)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle() as any);

    const { data: tiers } = await (supabase
      .from("loyalty_tier_config" as any)
      .select("*")
      .order("priority", { ascending: true }) as any);

    const tierList = (tiers || []) as any[];
    const currentLoyaltyTier = tierList.find(t => t.tier === (loyalty?.current_tier || 'starter'));
    const nextLoyaltyTier = tierList.find(t => t.priority === (currentLoyaltyTier?.priority ?? -1) + 1);

    // 3. VIP Status & Benefits
    const { data: vipConfig } = await (supabase
      .from("vip_configs" as any)
      .select("*") as any);
      
    const currentVip = (vipConfig || []).find((v: any) => v.tier === (profileData.vip_tier || 'none'));
    const nextVip = (vipConfig || []).find((v: any) => 
        profileData.vip_tier === 'none' ? v.tier === 'vip' : 
        profileData.vip_tier === 'vip' ? v.tier === 'gold' : 
        profileData.vip_tier === 'gold' ? v.tier === 'elite' : false
    );

    // 4. Community Goals
    const { data: goals } = await (supabase
      .from("community_goals" as any)
      .select("*")
      .order("target_members", { ascending: true }) as any);

    const { data: activeMembers } = await supabase
      .from("profiles")
      .select("count", { count: 'exact', head: true });
      
    const currentMemberCount = (activeMembers as any)?.count || 0;

    // 5. Staff Eligibility (Logic from request)
    const monthsActive = profileData.created_at 
      ? Math.floor((new Date().getTime() - new Date(profileData.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : 0;
      
    const isStaffEligible = 
        (currentLoyaltyTier?.priority || 0) >= 2 &&
        (profileData.reputation_score || 0) >= 90 &&
        monthsActive >= 6 &&
        (profileData.conversions_count || 0) >= 10;

    return {
      identity: {
        id: userId,
        nickname: profileData.display_name || profileData.full_name || profileData.email?.split('@')[0],
        avatar: (profileData.metadata as any)?.avatar_url || null,
        joinedAt: profileData.created_at || new Date().toISOString(),
        status: 'active'
      },
      loyalty: {
        points: loyalty?.points || 0,
        tier: currentLoyaltyTier?.name || 'Starter',
        daysActive: loyalty?.days_active || 0,
        progress: nextLoyaltyTier ? Math.min(100, (loyalty?.points || 0) / nextLoyaltyTier.min_points * 100) : 100,
        nextTier: nextLoyaltyTier?.name
      },
      community: {
        referrals: profileData.referrals_valid_count || 0,
        conversions: profileData.conversions_count || 0,
        memberCount: currentMemberCount,
        goals: goals || []
      },
      vip: {
        tier: profileData.vip_tier || 'none',
        config: currentVip,
        next: nextVip,
        benefits: currentVip?.benefits || []
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
    const { supabase, userId } = context;
    const { data: newTier, error } = await (supabase.rpc as any)('calculate_vip_eligibility', { _user_id: userId });
    
    if (error) throw error;
    
    const { error: updateError } = await (supabase
      .from("profiles")
      .update({ vip_tier: newTier } as any)
      .eq("id", userId) as any);
      
    if (updateError) throw updateError;
    
    return { tier: newTier };
  });
