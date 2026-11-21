export const LIFETIME_OFFER_PLAN_SLUG = "login-lifetime";
export const LIFETIME_OFFER_REGULAR_PRICE_BRL = 1700;
export const LIFETIME_OFFER_PRICE_BRL = 999.9;
// O link antigo cobra R$ 999,99. Aguarda o checkout correto de R$ 999,90.
export const LIFETIME_OFFER_CHECKOUT_URL: string | null = null;

export function hasLifetimeOffer(planSlug: string, regularPriceBrl: number): boolean {
  return planSlug === LIFETIME_OFFER_PLAN_SLUG && regularPriceBrl === LIFETIME_OFFER_REGULAR_PRICE_BRL;
}
