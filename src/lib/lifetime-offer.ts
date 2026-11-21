export const LIFETIME_OFFER_PLAN_SLUG = "login-lifetime";
export const LIFETIME_OFFER_REGULAR_PRICE_BRL = 1700;
export const LIFETIME_OFFER_PRICE_BRL = 999.99;
export const LIFETIME_OFFER_CHECKOUT_URL: string | null = "https://pay.cakto.com.br/3ehdy6q_1332037";

export function hasLifetimeOffer(planSlug: string, regularPriceBrl: number): boolean {
  return planSlug === LIFETIME_OFFER_PLAN_SLUG && regularPriceBrl === LIFETIME_OFFER_REGULAR_PRICE_BRL;
}
