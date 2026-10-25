import { describe, expect, it } from "vitest";
import { manualPaymentError, resolveManualAmount, manualPaymentAuditMeta, MANUAL_PAYMENT_METHOD } from "../manual-payment-rules";

const plan = (over: Partial<{ slug: string; name: string; price_brl: number; category: string; active: boolean }> = {}) => ({
  slug: "login-30d", name: "Login 30 dias", price_brl: 97, category: "license", active: true, ...over,
});

describe("manualPaymentError", () => {
  it("aceita plano de licença ativo sem login alvo", () => {
    expect(manualPaymentError({ plan: plan() })).toBeNull();
  });
  it("recusa plano inexistente ou inativo", () => {
    expect(manualPaymentError({ plan: null })).toMatch(/Plano não encontrado/);
    expect(manualPaymentError({ plan: plan({ active: false }) })).toMatch(/Plano não encontrado/);
  });
  it("recusa plano sem preço válido", () => {
    expect(manualPaymentError({ plan: plan({ price_brl: 0 }) })).toMatch(/preço válido/);
    expect(manualPaymentError({ plan: plan({ price_brl: Number("abc") }) })).toMatch(/preço válido/);
  });
  it("exige login alvo para renovação de servidor", () => {
    expect(manualPaymentError({ plan: plan({ category: "server" }) })).toMatch(/Selecione o login/);
    expect(manualPaymentError({ plan: plan({ category: "server" }), targetLicenseId: "00000000-0000-0000-0000-000000000000" })).toBeNull();
  });
  it("bloqueia upgrade no registro manual", () => {
    expect(manualPaymentError({ plan: plan({ category: "upgrade" }) })).toMatch(/Upgrade não pode/);
  });
  it("limita a observação em 300 caracteres", () => {
    expect(manualPaymentError({ plan: plan(), note: "x".repeat(301) })).toMatch(/300/);
    expect(manualPaymentError({ plan: plan(), note: "x".repeat(300) })).toBeNull();
  });
});

describe("resolveManualAmount", () => {
  it("usa o preço do plano quando a integridade confirma", () => {
    expect(resolveManualAmount(97, { ok: true, expectedAmount: 97 })).toEqual({ ok: true, amount: 97 });
  });
  it("usa o valor esperado quando só há divergência de valor (oferta de boas-vindas)", () => {
    expect(resolveManualAmount(1999.9, { ok: false, expectedAmount: 999.9, reason: "amount-mismatch" })).toEqual({ ok: true, amount: 999.9 });
  });
  it("recusa outros motivos de bloqueio", () => {
    const r = resolveManualAmount(97, { ok: false, expectedAmount: 0, reason: "invalid-plan" });
    expect(r.ok).toBe(false);
  });
  it("recusa divergência sem valor esperado válido", () => {
    const r = resolveManualAmount(97, { ok: false, expectedAmount: 0, reason: "amount-mismatch" });
    expect(r.ok).toBe(false);
  });
});

describe("manualPaymentAuditMeta", () => {
  it("registra método pix_externo e nunca inclui senha", () => {
    const meta = manualPaymentAuditMeta({ orderId: "o1", customerId: "c1", planSlug: "login-30d", amount: 97, note: "  pix no chat  " });
    expect(meta.method).toBe(MANUAL_PAYMENT_METHOD);
    expect(meta.note).toBe("pix no chat");
    expect(JSON.stringify(meta)).not.toMatch(/senha|password/i);
  });
  it("trunca observação longa", () => {
    const meta = manualPaymentAuditMeta({ orderId: "o1", customerId: "c1", planSlug: "p", amount: 1, note: "y".repeat(400) });
    expect(meta.note).toHaveLength(300);
  });
});
