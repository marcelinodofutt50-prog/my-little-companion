import { describe, expect, it } from "vitest";
import { requireCheckoutPlan } from "@/lib/checkout-plan";

describe("checkout catalog lookup", () => {
  it("preserves the available server plan and its configured price", () => {
    const plan = { slug: "server-monthly-legacy", price_brl: 250, category: "server" };
    expect(requireCheckoutPlan(plan, null)).toBe(plan);
  });
  it("reports genuine absence separately from a failed query", () => {
    expect(() => requireCheckoutPlan(null, null)).toThrow("Plano não encontrado");
    expect(() => requireCheckoutPlan(null, { code: "42501" })).toThrow("Não foi possível consultar o plano agora");
  });
  it("does not accept data returned alongside a database error", () => {
    expect(() => requireCheckoutPlan({ slug: "server-monthly" }, { code: "connection" })).toThrow();
  });
});