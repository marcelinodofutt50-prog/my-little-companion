/**
 * SHADOW MISSIONS — cálculo de progresso (server-only).
 * Fonte única de verdade usada tanto pelo Shadow Pass quanto pelo resgate de
 * recompensas, evitando que o cliente reivindique missões não concluídas.
 */

export const VIP_TIER_ORDER = ["none", "bronze", "silver", "gold", "diamond", "elite"] as const;
export type VipTier = (typeof VIP_TIER_ORDER)[number];

export function vipRank(tier?: string | null): number {
  const idx = VIP_TIER_ORDER.indexOf((tier || "none") as VipTier);
  return idx < 0 ? 0 : idx;
}

export type MissionMetrics = {
  trials: number;
  tutorials: number;
  referrals: number;
  conversions: number;
  purchases: number;
  profileComplete: boolean;
  vipTier: string;
  loyaltyPoints: number;
  daysActive: number;
  messages: number;
};

export async function loadMissionMetrics(
  supabaseAdmin: any,
  userId: string,
): Promise<MissionMetrics> {
  const [profileRes, loyaltyRes, trialsRes, tutorialsRes, purchasesRes, messagesRes] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "display_name, avatar_url, metadata, referrals_valid_count, conversions_count, vip_tier",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_loyalty")
        .select("points, days_active")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("licenses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_trial", true),
      supabaseAdmin
        .from("tutorial_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("completed", true),
      supabaseAdmin
        .from("licenses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_trial", false)
        .eq("revoked", false),
      supabaseAdmin
        .from("community_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

  const profile: any = profileRes?.data || {};
  const meta = (profile.metadata as any) || {};

  return {
    trials: trialsRes?.count || 0,
    tutorials: tutorialsRes?.count || 0,
    referrals: profile.referrals_valid_count || 0,
    conversions: profile.conversions_count || 0,
    purchases: purchasesRes?.count || 0,
    profileComplete:
      (!!meta.avatar_url || !!profile.avatar_url) && !!(meta.nickname || profile.display_name),
    vipTier: profile.vip_tier || "none",
    loyaltyPoints: loyaltyRes?.data?.points || 0,
    daysActive: loyaltyRes?.data?.days_active || 0,
    messages: messagesRes?.count || 0,
  };
}

/** Retorna 0..100 para o requisito de uma missão. */
export function missionProgress(requirements: any, m: MissionMetrics): number {
  const type = requirements?.type;
  const target = Number(requirements?.count ?? requirements?.value ?? 1) || 1;
  const pct = (v: number) => Math.min(100, Math.round((v / target) * 100));

  switch (type) {
    case "profile_setup":
      return m.profileComplete ? 100 : 0;
    case "trial_generation":
      return pct(m.trials);
    case "tutorial_completion":
      return pct(m.tutorials);
    case "referral":
      return pct(m.referrals);
    case "conversion":
      return pct(m.conversions);
    case "purchase":
      return pct(m.purchases);
    case "community_message":
      return pct(m.messages);
    case "loyalty_points":
      return pct(m.loyaltyPoints);
    case "days_active":
      return pct(m.daysActive);
    case "vip_tier":
      return vipRank(m.vipTier) >= vipRank(requirements?.tier) ? 100 : 0;
    default:
      return 0;
  }
}
