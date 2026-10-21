export const LIFETIME_PROMO_PRICE_BRL = 999;
export const LIFETIME_PROMO_START_MS = Date.parse('2026-10-21T01:28:00Z');
export const LIFETIME_PROMO_END_MS = LIFETIME_PROMO_START_MS + 60 * 24 * 60 * 60 * 1000;

export function lifetimePromoRemainingMs(now: number): number {
  return Math.max(0, LIFETIME_PROMO_END_MS - now);
}

export function lifetimePromoClock(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(seconds / 86400)}d ${pad(Math.floor(seconds / 3600) % 24)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}