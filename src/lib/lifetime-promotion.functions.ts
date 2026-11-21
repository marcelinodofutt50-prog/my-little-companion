import { createServerFn } from "@tanstack/react-start";
import { LIFETIME_OFFER_CHECKOUT_URL } from "./lifetime-offer";

export const getLifetimePromotion = createServerFn({ method: "GET" }).handler(async () => {
  return { active: Boolean(LIFETIME_OFFER_CHECKOUT_URL) };
});

export const getLifetimePromotionLink = createServerFn({ method: "POST" }).handler(async () => {
  return LIFETIME_OFFER_CHECKOUT_URL;
});
