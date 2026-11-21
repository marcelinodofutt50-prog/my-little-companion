export const LIFETIME_OFFER_PLAN_SLUG = "login-lifetime";
export const LIFETIME_OFFER_REGULAR_PRICE_BRL = 1700;
export const LIFETIME_OFFER_PRICE_BRL = 999.99;
export const LIFETIME_OFFER_CHECKOUT_URL: string | null = "https://pay.cakto.com.br/3ehdy6q_1332037";
export const LIFETIME_OFFER_WINDOW_MS = 6 * 60 * 60 * 1000;

export function hasLifetimeOffer(planSlug: string, regularPriceBrl: number): boolean {
  return planSlug === LIFETIME_OFFER_PLAN_SLUG && regularPriceBrl === LIFETIME_OFFER_REGULAR_PRICE_BRL;
}

/** Tempo restante da oferta de boas-vindas; zero quando a conta não é elegível. */
export function lifetimeOfferRemainingMs(
  accountCreatedAt: string | Date | null | undefined,
  now = Date.now(),
): number {
  if (!accountCreatedAt || !Number.isFinite(now)) return 0;
  const createdAt = new Date(accountCreatedAt).getTime();
  if (!Number.isFinite(createdAt)) return 0;
  return Math.min(
    LIFETIME_OFFER_WINDOW_MS,
    Math.max(0, createdAt + LIFETIME_OFFER_WINDOW_MS - now),
  );
}
