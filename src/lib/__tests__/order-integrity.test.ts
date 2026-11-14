import { describe, expect, it } from "vitest";
import { validateCanonicalOrderAmount, type CanonicalOrder } from "@/lib/order-integrity.server";

function catalogClient(price = 1700) {
  return {
    from(table: string) {
      if (table !== "plans") throw new Error(`Tabela inesperada: ${table}`);
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({
          data: { slug: "login-lifetime", name: "Vitalício", price_brl: price, active: true },
          error: null,
        }),
      };
    },
  };
}

function lifetimeOrder(amount: number): CanonicalOrder {
  return {
    id: "order-1",
    user_id: "new-member",
    plan_slug: "login-lifetime",
    amount,
    created_at: new Date().toISOString(),
    metadata: {},
  };
}

describe("preço do Vitalício sem promoção de boas-vindas", () => {
  it("aceita o preço normal de R$ 1.700 mesmo em um pedido criado agora", async () => {
    const result = await validateCanonicalOrderAmount(catalogClient(), lifetimeOrder(1700));
    expect(result).toMatchObject({ ok: true, expectedAmount: 1700, actualAmount: 1700 });
  });

  it("não aceita mais o antigo valor promocional de R$ 999,90", async () => {
    const result = await validateCanonicalOrderAmount(catalogClient(), lifetimeOrder(999.9));
    expect(result).toMatchObject({ ok: false, expectedAmount: 1700, actualAmount: 999.9, reason: "amount-mismatch" });
  });
});
