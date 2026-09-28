// Oferta de boas-vindas: todo membro novo paga o Vitalício por R$ 999,90
// durante as primeiras 6h30 depois de criar a conta.
export const WELCOME_PLAN_SLUG = "login-lifetime";
export const WELCOME_PRICE_BRL = 999.9;
export const WELCOME_WINDOW_MS = 6.5 * 60 * 60 * 1000;

/** Milissegundos restantes da oferta (0 = acabou). */
export function welcomeRemainingMs(accountCreatedAt: string | Date | null | undefined, now = Date.now()): number {
  if (!accountCreatedAt) return 0;
  const created = new Date(accountCreatedAt).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, created + WELCOME_WINDOW_MS - now);
}

export function welcomePriceFor(planSlug: string, basePrice: number, accountCreatedAt: string | Date | null | undefined, now = Date.now()): number | null {
  if (planSlug !== WELCOME_PLAN_SLUG) return null;
  if (welcomeRemainingMs(accountCreatedAt, now) <= 0) return null;
  return Math.min(basePrice, WELCOME_PRICE_BRL);
}
