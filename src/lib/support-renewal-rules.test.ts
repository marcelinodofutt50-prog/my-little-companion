import { describe, expect, it } from "vitest";
import { canAutoCloseSupport, customerConfirmedResolution, isServerRenewalRequest } from "./support-renewal-rules";
const now = Date.parse("2026-10-25T12:00:00Z");
const message = (body: string, hours = 6) => ({ body, is_admin: false, created_at: new Date(now - hours * 3600_000).toISOString() });
describe("support renewal and safe closure", () => {
  it("recognizes renewal requests with accents", () => {
    expect(isServerRenewalRequest("Não tô conseguindo renovar meu servidor")).toBe(true);
    expect(isServerRenewalRequest("Quero pagar a mensalidade do servidor")).toBe(true);
    expect(isServerRenewalRequest("Meu APK deu erro")).toBe(false);
  });
  it("never closes unresolved or pending-payment tickets", () => {
    expect(canAutoCloseSupport([message("não consegui renovar")], false, now)).toBe(false);
    expect(canAutoCloseSupport([message("Resolvido")], true, now)).toBe(false);
    expect(customerConfirmedResolution("Resolvido mas falta liberar o pagamento")).toBe(false);
    expect(customerConfirmedResolution("Obrigado")).toBe(false);
  });
  it("waits five hours after confirmation", () => {
    expect(canAutoCloseSupport([message("Agora funcionou", 4)], false, now)).toBe(false);
    expect(canAutoCloseSupport([message("Agora funcionou", 5)], false, now)).toBe(true);
  });
  it("a new problem cancels an earlier resolution", () => {
    expect(canAutoCloseSupport([message("Resolvido", 8), message("Ainda não foi", 6)], false, now)).toBe(false);
  });
});