/** Referral reward policy: 3 days for the referrer, 1 welcome day for the buyer. */
export const REFERRER_PURCHASE_REWARD_DAYS = 3;
export const BUYER_REFERRAL_BONUS_DAYS = 1;

export function calculateRewardExpiry(
  currentExpiry: string | null | undefined,
  days: number,
  now = new Date(),
): string {
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    throw new Error("Quantidade de dias de recompensa inválida.");
  }
  const existing = currentExpiry ? new Date(currentExpiry) : null;
  const base = existing && Number.isFinite(existing.getTime()) && existing > now
    ? new Date(existing)
    : new Date(now);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString();
}

/** Purchase rewards apply only to paid, non-server purchases with a distinct referrer. */
export function isReferralRewardEligible(order: {
  status?: string | null;
  user_id?: string | null;
  referrer_id?: string | null;
  plan_slug?: string | null;
  metadata?: unknown;
}): boolean {
  if (order.status !== "paid" || !order.user_id || !order.referrer_id || order.user_id === order.referrer_id) return false;
  if (String(order.plan_slug ?? "").toLowerCase().startsWith("server-")) return false;
  const metadata = order.metadata && typeof order.metadata === "object" ? order.metadata as Record<string, unknown> : {};
  if (metadata.referral_rewards_version !== 1 || metadata.gift) return false;
  return true;
}
