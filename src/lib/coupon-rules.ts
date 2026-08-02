// Regras puras de cupom — compartilhadas pelo checkout e pela validação da UI,
// para que a interface nunca mostre um desconto que o servidor não honra.

export type CouponLike = {
  code: string;
  active?: boolean | null;
  user_id?: string | null;
  expires_at?: string | null;
  plan_slug?: string | null;
  uses_left?: number | null;
  discount_pct?: number | null;
};

export type CouponCheck =
  | { ok: true; discountPct: number }
  | { ok: false; reason: "not_found" | "inactive" | "not_owner" | "expired" | "wrong_plan" | "used_up" };

export const MAX_DISCOUNT_PCT = 90;
export const MIN_CHARGE_BRL = 1;

export function evaluateCoupon(
  coupon: CouponLike | null | undefined,
  ctx: { userId: string; planSlug?: string | null; now?: number }
): CouponCheck {
  if (!coupon) return { ok: false, reason: "not_found" };
  if (coupon.active === false) return { ok: false, reason: "inactive" };
  if (coupon.user_id && coupon.user_id !== ctx.userId) return { ok: false, reason: "not_owner" };
  const now = ctx.now ?? Date.now();
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= now) {
    return { ok: false, reason: "expired" };
  }
  if (coupon.plan_slug && ctx.planSlug && coupon.plan_slug !== ctx.planSlug) {
    return { ok: false, reason: "wrong_plan" };
  }
  if (coupon.uses_left !== null && coupon.uses_left !== undefined && Number(coupon.uses_left) <= 0) {
    return { ok: false, reason: "used_up" };
  }
  return { ok: true, discountPct: clampDiscountPct(coupon.discount_pct) };
}

export function clampDiscountPct(pct: unknown): number {
  const n = Number(pct ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_DISCOUNT_PCT, Math.max(0, n));
}

export function applyDiscount(amount: number, pct: unknown): number {
  const discounted = amount * (1 - clampDiscountPct(pct) / 100);
  // Arredonda em centavos: evita 44.99999999 virar cobrança diferente da exibida.
  return Math.max(MIN_CHARGE_BRL, Math.round(discounted * 100) / 100);
}
