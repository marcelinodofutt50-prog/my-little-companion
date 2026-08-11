import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function grant7DayTrialBenefit(userId: string, planSlug: string) {
  console.log(`[BenefitService] Granting 7-day benefit to user ${userId} for plan ${planSlug}`);
  
  const startedAt = new Date();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // 1. Check if user already had this benefit to prevent abuse
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("trial_7d_expires_at, metadata")
    .eq("id", userId)
    .single();

  if (profile?.trial_7d_expires_at) {
    console.log(`[BenefitService] User ${userId} already has/had a 7-day benefit. Skipping to prevent abuse.`);
    return;
  }

  // 2. Update profile with benefit expiry
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      trial_7d_started_at: startedAt.toISOString(),
      trial_7d_expires_at: expiresAt.toISOString(),
      metadata: {
        ...(profile?.metadata as any || {}),
        benefit_source_plan: planSlug,
        benefit_granted_at: startedAt.toISOString()
      }
    })
    .eq("id", userId);

  if (error) {
    console.error(`[BenefitService] Failed to grant benefit to ${userId}:`, error);
    throw error;
  }

  // 3. Log the point reward for purchasing
  const purchasePoints = planSlug === 'vitalicio' ? 2000 : 500;
  
  await supabaseAdmin.from("profiles").update({
    reward_points: (profile?.reward_points || 0) + purchasePoints,
    total_points_earned: (profile?.total_points_earned || 0) + purchasePoints
  }).eq("id", userId);

  await supabaseAdmin.from("points_history").insert({
    user_id: userId,
    amount: purchasePoints,
    reason: `Bônus de compra: ${planSlug}`,
    metadata: { plan_slug: planSlug }
  });

  console.log(`[BenefitService] Successfully granted 7-day benefit and ${purchasePoints} points to user ${userId}`);
}
