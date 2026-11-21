import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LIFETIME_OFFER_CHECKOUT_URL } from "./lifetime-offer";

/** Informação pública do anúncio; não representa elegibilidade da conta. */
export const getLifetimePromotion = createServerFn({ method: "GET" }).handler(async () => {
  return { active: Boolean(LIFETIME_OFFER_CHECKOUT_URL) };
});

export const getMyLifetimePromotion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getLifetimeOfferEligibility } = await import("./lifetime-promotion.server");
    return getLifetimeOfferEligibility(context.userId);
  });

export const getLifetimePromotionLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getLifetimeOfferEligibility } = await import("./lifetime-promotion.server");
    const eligibility = await getLifetimeOfferEligibility(context.userId);
    return eligibility.active ? LIFETIME_OFFER_CHECKOUT_URL : null;
  });
