import { describe, expect, it } from "vitest";
import { looksLikeCardNumber, parseAmountInput, purchaseRecordInputSchema, totalRecordedPurchases } from "../purchase-records";

const uid = "11111111-1111-4111-8111-111111111111";

describe("purchaseRecordInputSchema", () => {
  it("requires a product for a purchase", () => {
    expect(purchaseRecordInputSchema.safeParse({ userId: uid, kind: "purchase" }).success).toBe(false);
    expect(purchaseRecordInputSchema.safeParse({ userId: uid, kind: "purchase", title: "Plano mensal", amount: 550 }).success).toBe(true);
  });
  it("requires text for a note and refuses a product or amount on it", () => {
    expect(purchaseRecordInputSchema.safeParse({ userId: uid, kind: "note" }).success).toBe(false);
    expect(purchaseRecordInputSchema.safeParse({ userId: uid, kind: "note", note: "Pagou por PIX", amount: 10 }).success).toBe(false);
    expect(purchaseRecordInputSchema.safeParse({ userId: uid, kind: "note", note: "Pagou por PIX" }).success).toBe(true);
  });
  it("refuses amounts above 1,000,000 and negative ones", () => {
    expect(purchaseRecordInputSchema.safeParse({ userId: uid, kind: "purchase", title: "x", amount: 1_000_001 }).success).toBe(false);
    expect(purchaseRecordInputSchema.safeParse({ userId: uid, kind: "purchase", title: "x", amount: -1 }).success).toBe(false);
  });
  it("refuses card numbers in notes and titles", () => {
    expect(purchaseRecordInputSchema.safeParse({ userId: uid, kind: "note", note: "cartão 4111 1111 1111 1111" }).success).toBe(false);
  });
  it("refuses impossible dates", () => {
    expect(purchaseRecordInputSchema.safeParse({ userId: uid, kind: "purchase", title: "x", purchasedOn: "2026-02-31" }).success).toBe(false);
  });
});

describe("looksLikeCardNumber", () => {
  it("does not flag a short number such as a price or CPF", () => {
    expect(looksLikeCardNumber("pagou 1200 reais, CPF final 12345678901")).toBe(false);
  });
});

describe("parseAmountInput", () => {
  it("reads Brazilian formats", () => {
    expect(parseAmountInput("1.234,56")).toBe(1234.56);
    expect(parseAmountInput("R$ 350")).toBe(350);
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("abc")).toBe("invalid");
  });
});

describe("totalRecordedPurchases", () => {
  it("sums only purchases", () => {
    const base = { title: null, note: null, purchasedOn: null, createdAt: "", receipt: null };
    expect(totalRecordedPurchases([
      { ...base, id: "a", kind: "purchase", amount: 350.1 },
      { ...base, id: "b", kind: "purchase", amount: 549.9 },
      { ...base, id: "c", kind: "note", amount: null },
    ])).toBe(900);
  });
});
