import { describe, expect, it } from "vitest";
import {
  addDays,
  decideSyncAction,
  isResellerEntitlementActive,
  PARTNER_PLAN_DAYS,
  planPartnerRenewal,
  summarizeDesk,
  resolveLicenseDays,
  daysLeft,
  buildCredentialMessage,
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

describe("emissão estruturada de licenças", () => {
  it("usa os dias do plano quando não há prazo personalizado", () => {
    expect(resolveLicenseDays("login-7d", null)).toBe(7);
    expect(resolveLicenseDays("login-30d", undefined)).toBe(30);
    expect(resolveLicenseDays("plano-desconhecido", null)).toBe(30);
  });

  it("respeita o prazo personalizado e limita a 3650 dias", () => {
    expect(resolveLicenseDays("login-7d", 45)).toBe(45);
    expect(resolveLicenseDays("login-7d", 99999)).toBe(3650);
    expect(resolveLicenseDays("login-7d", 0)).toBe(7);
    expect(resolveLicenseDays("login-7d", -5)).toBe(7);
  });

  it("calcula os dias restantes e o vencimento", () => {
    const now = new Date("2026-01-10T12:00:00Z");
    expect(daysLeft(null, now)).toBeNull();
    expect(daysLeft("2026-01-15T12:00:00Z", now)).toBe(5);
    expect(daysLeft("2026-01-05T12:00:00Z", now)).toBe(-5);
  });

  it("monta a mensagem pronta com todos os dados do acesso", () => {
    const msg = buildCredentialMessage({
      customerName: "João",
      email: "a@b.com",
      username: "joao123",
      password: "S3nh@Forte",
      expiresAt: "2026-02-01T00:00:00Z",
    });
    expect(msg).toContain("Olá, João!");
    expect(msg).toContain("a@b.com");
    expect(msg).toContain("joao123");
    expect(msg).toContain("S3nh@Forte");
    expect(msg).toContain("Validade:");
  });

  it("conta licenças que vencem em até 5 dias", () => {
    const now = new Date("2026-01-10T12:00:00Z");
    const s = summarizeDesk(
      [
        { status: "active", expires_at: "2026-01-12T12:00:00Z" },
        { status: "active", expires_at: "2026-03-12T12:00:00Z" },
        { status: "cancelled", expires_at: "2026-01-11T12:00:00Z" },
      ],
      [],
      [],
      now,
    );
    expect(s.activeLicenses).toBe(2);
    expect(s.expiringSoon).toBe(1);
  });
});
