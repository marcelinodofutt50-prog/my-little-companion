import { describe, it, expect } from "vitest";
import { evaluateCoupon, applyDiscount, clampDiscountPct } from "@/lib/coupon-rules";
import { computeWinbackTier, generateWinbackCode, WINBACK_TTL_MINUTES } from "@/lib/winback.server";

const ME = "user-1";
const base = { code: "VOLTA-ABCDE", active: true, uses_left: 1, discount_pct: 10 };

describe("evaluateCoupon", () => {
  it("aceita cupom pessoal válido no plano certo", () => {
    const r = evaluateCoupon({ ...base, user_id: ME, plan_slug: "mensal" }, { userId: ME, planSlug: "mensal" });
    expect(r).toEqual({ ok: true, discountPct: 10 });
  });

  it("recusa cupom de outro dono", () => {
    expect(evaluateCoupon({ ...base, user_id: "outro" }, { userId: ME })).toEqual({ ok: false, reason: "not_owner" });
  });

  it("recusa cupom expirado", () => {
    const r = evaluateCoupon({ ...base, user_id: ME, expires_at: new Date(Date.now() - 1000).toISOString() }, { userId: ME });
    expect(r).toEqual({ ok: false, reason: "expired" });
  });

  it("recusa cupom de outro plano", () => {
    const r = evaluateCoupon({ ...base, user_id: ME, plan_slug: "mensal" }, { userId: ME, planSlug: "server-monthly" });
    expect(r).toEqual({ ok: false, reason: "wrong_plan" });
  });

  it("recusa cupom já consumido", () => {
    expect(evaluateCoupon({ ...base, user_id: ME, uses_left: 0 }, { userId: ME })).toEqual({ ok: false, reason: "used_up" });
  });

  it("recusa inexistente e inativo", () => {
    expect(evaluateCoupon(null, { userId: ME })).toEqual({ ok: false, reason: "not_found" });
    expect(evaluateCoupon({ ...base, active: false }, { userId: ME })).toEqual({ ok: false, reason: "inactive" });
  });

  it("cupom global (sem dono/plano) vale para qualquer um", () => {
    expect(evaluateCoupon({ code: "PROMO", active: true, uses_left: null, discount_pct: 5 }, { userId: ME, planSlug: "x" }).ok).toBe(true);
  });
});

describe("desconto", () => {
  it("limita a 90% e nunca cobra menos de R$1", () => {
    expect(clampDiscountPct(500)).toBe(90);
    expect(clampDiscountPct(-10)).toBe(0);
    expect(clampDiscountPct("abc")).toBe(0);
    expect(applyDiscount(450, 100)).toBe(45);
    expect(applyDiscount(2, 99)).toBe(1);
    expect(applyDiscount(450, 10)).toBe(405);
  });
});

describe("faixas do winback", () => {
  it("aplica o desconto conforme o histórico", () => {
    expect(computeWinbackTier({ paidOrders: 0, totalSpent: 0, isLegacy: false }).discountPct).toBe(5);
    expect(computeWinbackTier({ paidOrders: 1, totalSpent: 450, isLegacy: false }).discountPct).toBe(8);
    expect(computeWinbackTier({ paidOrders: 3, totalSpent: 900, isLegacy: false }).discountPct).toBe(12);
    expect(computeWinbackTier({ paidOrders: 1, totalSpent: 1200, isLegacy: false }).discountPct).toBe(12);
    expect(computeWinbackTier({ paidOrders: 5, totalSpent: 5000, isLegacy: true }).discountPct).toBe(15);
  });

  it("gera código no formato VOLTA-XXXXX e expira em 30 min", () => {
    expect(generateWinbackCode()).toMatch(/^VOLTA-[A-Z2-9]{5}$/);
    expect(WINBACK_TTL_MINUTES).toBe(30);
  });
});
