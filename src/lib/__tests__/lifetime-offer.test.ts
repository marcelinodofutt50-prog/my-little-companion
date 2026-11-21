import { describe, expect, it } from "vitest";
import {
  hasLifetimeOffer,
  LIFETIME_OFFER_PRICE_BRL,
  LIFETIME_OFFER_REGULAR_PRICE_BRL,
  LIFETIME_OFFER_WINDOW_MS,
  lifetimeOfferRemainingMs,
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

  it("mantém a oferta durante exatamente 6 horas após a criação da conta", () => {
    const createdAt = "2026-11-21T10:00:00.000Z";
    const now = new Date(createdAt).getTime();
    expect(LIFETIME_OFFER_WINDOW_MS).toBe(21_600_000);
    expect(lifetimeOfferRemainingMs(createdAt, now)).toBe(21_600_000);
    expect(lifetimeOfferRemainingMs(createdAt, now + 21_599_999)).toBe(1);
    expect(lifetimeOfferRemainingMs(createdAt, now + 21_600_000)).toBe(0);
  });

  it("não oferece o desconto sem uma data de cadastro válida", () => {
    expect(lifetimeOfferRemainingMs(null, Date.now())).toBe(0);
    expect(lifetimeOfferRemainingMs("data-inválida", Date.now())).toBe(0);
  });
});
