import { describe, expect, it } from "vitest";
import {
  addDays,
  decideSyncAction,
  isResellerEntitlementActive,
  PARTNER_PLAN_DAYS,
  planPartnerRenewal,
  summarizeDesk,
} from "@/lib/partner-reseller.server";

/**
 * Fluxo real da revenda: acesso liberado após o pagamento, criação da licença,
 * sincronização com o painel, renovação por pagamento e histórico.
 */
describe("acesso de revenda", () => {
  const now = new Date("2026-03-10T12:00:00.000Z");

  it("libera apenas quem tem revenda ativa", () => {
    expect(isResellerEntitlementActive({ kind: "reseller", status: "active", expires_at: null }, now)).toBe(true);
    expect(
      isResellerEntitlementActive({ kind: "reseller", status: "active", expires_at: "2026-05-01T00:00:00Z" }, now),
    ).toBe(true);
  });

  it("bloqueia acesso vencido, cancelado ou de outro produto", () => {
    expect(
      isResellerEntitlementActive({ kind: "reseller", status: "active", expires_at: "2026-01-01T00:00:00Z" }, now),
    ).toBe(false);
    expect(isResellerEntitlementActive({ kind: "reseller", status: "cancelled", expires_at: null }, now)).toBe(false);
    expect(isResellerEntitlementActive({ kind: "managed", status: "active", expires_at: null }, now)).toBe(false);
  });
});

describe("sincronização com o painel", () => {
  it("reafirma senha e validade quando a conta existe", () => {
    expect(decideSyncAction("found")).toBe("reaffirm");
  });

  it("recria só quando o painel confirma que a conta sumiu", () => {
    expect(decideSyncAction("missing")).toBe("create");
  });

  it("não mexe em nada quando o painel não responde", () => {
    expect(decideSyncAction("unknown")).toBe("abort");
  });
});

describe("renovação por pagamento", () => {
  const now = new Date("2026-03-10T12:00:00.000Z");

  it("soma os dias do plano a partir da data futura já paga", () => {
    const next = planPartnerRenewal("login-30d", "2026-03-25T00:00:00.000Z", now);
    expect(next.toISOString().slice(0, 10)).toBe("2026-04-24");
  });

  it("recomeça de hoje quando a licença já venceu", () => {
    const next = planPartnerRenewal("login-30d", "2026-01-01T00:00:00.000Z", now);
    expect(next.toISOString().slice(0, 10)).toBe("2026-04-09");
  });

  it("usa 7 dias no plano semanal e nunca encurta", () => {
    const next = planPartnerRenewal("login-7d", null, now);
    expect(next.toISOString().slice(0, 10)).toBe("2026-03-17");
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it("mantém o vitalício muito à frente", () => {
    expect(PARTNER_PLAN_DAYS["login-lifetime"]).toBeGreaterThan(3650);
    expect(addDays(now, PARTNER_PLAN_DAYS["login-lifetime"]!).getFullYear()).toBeGreaterThan(2040);
  });
});

describe("painel do parceiro", () => {
  it("resume clientes, licenças ativas, pendências e faturamento", () => {
    const s = summarizeDesk(
      [{ status: "active" }, { status: "pending_sync" }, { status: "cancelled" }],
      [{ amount_cents: 5000 }, { amount_cents: 2500 }],
      [{ id: "a" }, { id: "b" }],
    );
    expect(s).toEqual({ customers: 2, activeLicenses: 1, pendingSync: 1, revenueCents: 7500 });
  });

  it("começa zerado para um parceiro novo", () => {
    expect(summarizeDesk([], [], [])).toEqual({
      customers: 0,
      activeLicenses: 0,
      pendingSync: 0,
      revenueCents: 0,
    });
  });
});
