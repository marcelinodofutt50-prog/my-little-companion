import { describe, expect, it } from "vitest";
import {
  hasLifetimeOffer,
  LIFETIME_OFFER_PRICE_BRL,
  LIFETIME_OFFER_REGULAR_PRICE_BRL,
} from "@/lib/lifetime-offer";

describe("oferta do plano Vitalício", () => {
  it("oferece o Vitalício de R$ 1.700 por R$ 999,99", () => {
    expect(LIFETIME_OFFER_REGULAR_PRICE_BRL).toBe(1700);
    expect(LIFETIME_OFFER_PRICE_BRL).toBe(999.99);
    expect(hasLifetimeOffer("login-lifetime", 1700)).toBe(true);
  });

  it("não aplica a oferta a outros planos nem a um catálogo com outro preço", () => {
    expect(hasLifetimeOffer("login-30d", 1700)).toBe(false);
    expect(hasLifetimeOffer("login-lifetime", 1500)).toBe(false);
  });
});
