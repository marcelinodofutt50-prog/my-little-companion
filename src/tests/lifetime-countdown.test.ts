import { describe, expect, it } from 'vitest';
import { LIFETIME_PROMO_PRICE_BRL, LIFETIME_PROMO_START_MS, LIFETIME_PROMO_END_MS, lifetimePromoRemainingMs } from '../lib/lifetime-countdown';

describe('top lifetime promotion', () => {
  it('advertises the requested R$ 999', () => {
    expect(LIFETIME_PROMO_PRICE_BRL).toBe(999);
  });
  it('lasts exactly 60 days, using a fixed shared deadline', () => {
    expect(LIFETIME_PROMO_END_MS - LIFETIME_PROMO_START_MS).toBe(60 * 86400000);
    expect(lifetimePromoRemainingMs(LIFETIME_PROMO_START_MS + 86400000)).toBe(59 * 86400000);
  });
  it('expires without restarting', () => {
    expect(lifetimePromoRemainingMs(LIFETIME_PROMO_END_MS)).toBe(0);
    expect(lifetimePromoRemainingMs(LIFETIME_PROMO_END_MS + 1000)).toBe(0);
  });
});