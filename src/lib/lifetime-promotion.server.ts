import { lifetimeOfferRemainingMs } from "./lifetime-offer";

export type LifetimeOfferEligibility = {
  active: boolean;
  remainingMs: number;
};

/** Confere a data real de cadastro no servidor; falhas fecham a oferta. */
export async function getLifetimeOfferEligibility(
  userId: string,
  now = Date.now(),
): Promise<LifetimeOfferEligibility> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data.user) return { active: false, remainingMs: 0 };

    const remainingMs = lifetimeOfferRemainingMs(data.user.created_at, now);
    if (remainingMs <= 0) return { active: false, remainingMs: 0 };

    const { getActiveBan } = await import("./ban-engine.server");
    if (await getActiveBan(userId)) return { active: false, remainingMs: 0 };
    return { active: true, remainingMs };
  } catch (error) {
    console.error("[lifetime-offer] eligibility check failed", error);
    return { active: false, remainingMs: 0 };
  }
}
