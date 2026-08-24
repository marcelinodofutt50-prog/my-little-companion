import { describe, expect, it } from "vitest";
import { RECURRING_DAYS_BY_SLUG, SLUG_BY_RECURRING_PRICE } from "@/lib/stripe-payments.server";

describe("renovação por assinatura (webhook Stripe)", () => {
  it("traduz a chave de preço da Stripe para o plano do banco", () => {
    expect(SLUG_BY_RECURRING_PRICE["kraken_monthly"]).toBe("kraken-monthly");
    expect(SLUG_BY_RECURRING_PRICE["play_protect_monthly"]).toBe("play-protect-monthly");
    expect(SLUG_BY_RECURRING_PRICE["trial"]).toBe("trial");
  });

  it("resolve os dias do ciclo com slug ou chave da Stripe", () => {
    for (const key of ["kraken-monthly", "kraken_monthly", "play-protect-monthly", "play_protect_monthly", "monthly_457"]) {
      expect(RECURRING_DAYS_BY_SLUG[key]).toBe(30);
    }
    expect(RECURRING_DAYS_BY_SLUG["trial"]).toBe(7);
    expect(RECURRING_DAYS_BY_SLUG["login-7d"]).toBe(7);
  });
});
