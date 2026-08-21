import { describe, expect, it } from "vitest";
import { planServerRenewal, reconcilePanelExpiry } from "@/lib/server-renewal";

/**
 * Cenários do autoatendimento "Já paguei o servidor" quando o suporte já
 * ajustou a data direto no painel Yaarsa. Regra de ouro: o site nunca encurta
 * o acesso do cliente.
 */
describe("reconciliação com o painel Yaarsa", () => {
  const paidUntil = new Date("2026-09-20T23:59:59.000Z");

  it("aplica o ciclo normal quando o painel está atrás (mensal)", () => {
    const lic = { id: "1", expires_at: "2026-08-20T23:59:59.000Z" };
    const plan = planServerRenewal(lic, paidUntil);
    const rec = reconcilePanelExpiry(plan.panelExpireDate, "2026-08-20", plan.patch.expires_at);

    expect(rec.shouldPush).toBe(true);
    expect(rec.effectivePanelDate).toBe("2026-09-20");
    expect(rec.alreadyAhead).toBe(false);
    expect(rec.dbExpiresAt).toBe(paidUntil.toISOString());
  });

  it("preserva a data maior já corrigida manualmente no painel", () => {
    const lic = { id: "2", expires_at: "2026-08-20T23:59:59.000Z" };
    const plan = planServerRenewal(lic, paidUntil);
    const rec = reconcilePanelExpiry(plan.panelExpireDate, "2026-10-15", plan.patch.expires_at);

    expect(rec.shouldPush).toBe(false);
    expect(rec.alreadyAhead).toBe(true);
    expect(rec.effectivePanelDate).toBe("2026-10-15");
    expect(new Date(rec.dbExpiresAt!).getTime()).toBeGreaterThan(paidUntil.getTime());
  });

  it("mantém o vitalício vitalício mesmo quando o painel está à frente", () => {
    const lic = { id: "3", expires_at: null };
    const plan = planServerRenewal(lic, paidUntil);
    const rec = reconcilePanelExpiry(plan.panelExpireDate, "2026-12-01", null);

    expect(rec.shouldPush).toBe(false);
    expect(rec.dbExpiresAt).toBeNull();
  });

  it("segue o fluxo normal quando o painel não permite leitura", () => {
    const lic = { id: "4", expires_at: "2026-08-20T23:59:59.000Z" };
    const plan = planServerRenewal(lic, paidUntil);
    const rec = reconcilePanelExpiry(plan.panelExpireDate, null, plan.patch.expires_at);

    expect(rec.shouldPush).toBe(true);
    expect(rec.effectivePanelDate).toBe(plan.panelExpireDate);
  });

  it("nunca rebaixa a expiração longa do banco", () => {
    const lic = { id: "5", expires_at: "2027-01-10T00:00:00.000Z" };
    const plan = planServerRenewal(lic, paidUntil);
    const rec = reconcilePanelExpiry(plan.panelExpireDate, "2026-10-01", plan.patch.expires_at);

    expect(rec.dbExpiresAt).toBe("2027-01-10T00:00:00.000Z");
  });
});
