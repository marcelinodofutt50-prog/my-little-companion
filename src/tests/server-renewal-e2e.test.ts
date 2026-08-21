import { describe, it, expect, beforeEach } from "vitest";
import { planServerRenewal, isRenewable, ymd } from "@/lib/server-renewal";
import { licenseExpiryState } from "@/lib/expiry";
import { nextDay20 } from "@/lib/admin-shared";

/**
 * E2E do pagamento da mensalidade do servidor (corte dia 20).
 *
 * Simula o pagamento aprovado -> aplicação no banco -> sincronização com o
 * painel Yaarsa -> leitura do dashboard, validando para MENSAL e VITALÍCIO:
 *   1. expiração gravada no banco;
 *   2. status/acesso (deixa de ficar "inativa");
 *   3. contador de dias mostrado no site;
 *   4. data enviada ao Yaarsa (site e BTmob batendo).
 */

type Lic = { id: string } & Record<string, any>;

/** Painel Yaarsa falso: registra a data recebida por conta. */
class FakePanel {
  calls: { email: string; expireDate: string; panel: string }[] = [];
  offline = false;
  async extend(email: string, expireDate: string, panel: string) {
    if (this.offline) throw new Error("painel offline");
    this.calls.push({ email, expireDate, panel });
    return { Success: "ok" };
  }
  expiryOf(email: string) {
    const c = [...this.calls].reverse().find((x) => x.email === email);
    return c?.expireDate ?? null;
  }
}

/** Banco falso com as licenças do cliente. */
class FakeDb {
  constructor(public rows: Lic[]) {}
  get(id: string) {
    return this.rows.find((r) => r.id === id)!;
  }
  update(id: string, patch: Lic) {
    Object.assign(this.get(id), patch);
  }
}

/** Fluxo real do webhook: escolhe licenças, sincroniza painel e grava banco. */
async function simulatePaidServerFee(
  db: FakeDb,
  panel: FakePanel,
  opts: { targetLicenseId?: string; paidUntil: Date },
) {
  const touched = db.rows.filter(
    (l) =>
      isRenewable(l) &&
      (opts.targetLicenseId ? l.id === opts.targetLicenseId : true),
  );
  const failures: string[] = [];
  for (const l of touched) {
    const plan = planServerRenewal(l, opts.paidUntil);
    try {
      await panel.extend(l.yaarsa_email, plan.panelExpireDate, l.panel ?? "v457");
    } catch (e: any) {
      failures.push(`${l.id}:${e.message}`);
    }
    db.update(l.id, plan.patch);
  }
  return { touched: touched.map((l) => l.id), failures };
}

const DAY = 86400000;
const NOW = new Date("2026-09-05T12:00:00.000Z").getTime();

function monthlyLicense(over: Lic = {}): Lic {
  return {
    id: "lic-monthly",
    plan_slug: "monthly_457",
    yaarsa_email: "cliente.mensal@shadow.test",
    panel: "v457",
    is_trial: false,
    // Venceu ontem porque o servidor não foi pago.
    expires_at: new Date(NOW - DAY).toISOString(),
    server_paid_until: new Date(NOW - 15 * DAY).toISOString(),
    server_overdue_at: new Date(NOW - 2 * DAY).toISOString(),
    revoked: true,
    status: "expired",
    ...over,
  };
}

function lifetimeLicense(over: Lic = {}): Lic {
  return {
    id: "lic-lifetime",
    plan_slug: "lifetime_46",
    yaarsa_email: "cliente.vitalicio@shadow.test",
    panel: "v46",
    is_trial: false,
    // Vitalício = 20 anos no banco.
    expires_at: new Date(NOW + 20 * 365 * DAY).toISOString(),
    server_paid_until: new Date(NOW - 15 * DAY).toISOString(),
    server_overdue_at: new Date(NOW - 2 * DAY).toISOString(),
    revoked: true,
    status: "expired",
    ...over,
  };
}

describe("E2E — pagamento da mensalidade do servidor", () => {
  let panel: FakePanel;
  let paidUntil: Date;

  beforeEach(() => {
    panel = new FakePanel();
    paidUntil = nextDay20();
  });

  it("MENSAL: pagamento empurra a licença para o próximo dia 20 e reativa o acesso", async () => {
    const db = new FakeDb([monthlyLicense()]);
    const before = licenseExpiryState(db.get("lic-monthly") as any, NOW);
    expect(before.active).toBe(false);

    await simulatePaidServerFee(db, panel, { paidUntil });
    const lic = db.get("lic-monthly");

    // 1. expiração
    expect(new Date(lic.expires_at).getTime()).toBe(paidUntil.getTime());
    // 2. status
    expect(lic.status).toBe("active");
    expect(lic.revoked).toBe(false);
    expect(lic.server_overdue_at).toBeNull();
    expect(new Date(lic.server_paid_until).getTime()).toBe(paidUntil.getTime());
    // 3. contador do site
    const after = licenseExpiryState(lic as any, NOW);
    expect(after.active).toBe(true);
    expect(after.paused).toBe(false);
    expect(after.daysLeft).not.toBeNull();
    expect(after.daysLeft!).toBeGreaterThan(0);
    expect(after.countdownAt).toBe(lic.expires_at);
    // 4. Yaarsa recebeu exatamente a mesma data
    expect(panel.expiryOf(lic.yaarsa_email)).toBe(ymd(paidUntil));
    expect(panel.expiryOf(lic.yaarsa_email)).toBe(String(lic.expires_at).slice(0, 10));
  });

  it("VITALÍCIO: pagamento renova só o servidor e preserva a data longa", async () => {
    const db = new FakeDb([lifetimeLicense()]);
    const originalExpiry = db.get("lic-lifetime").expires_at;

    await simulatePaidServerFee(db, panel, { paidUntil });
    const lic = db.get("lic-lifetime");

    // 1. expiração intacta (não é rebaixada para o dia 20)
    expect(lic.expires_at).toBe(originalExpiry);
    // 2. status
    expect(lic.status).toBe("active");
    expect(lic.revoked).toBe(false);
    expect(new Date(lic.server_paid_until).getTime()).toBe(paidUntil.getTime());
    // 3. site: sem contador de licença, mas com contador do servidor
    const after = licenseExpiryState(lic as any, NOW);
    expect(after.active).toBe(true);
    expect(after.countdownAt).toBeNull();
    expect(after.daysLeft).toBeNull();
    expect(after.serverDaysLeft).not.toBeNull();
    expect(after.serverDaysLeft!).toBeGreaterThanOrEqual(0);
    // 4. Yaarsa fica com a data longa, não com o dia 20
    expect(panel.expiryOf(lic.yaarsa_email)).toBe(String(originalExpiry).slice(0, 10));
    expect(panel.expiryOf(lic.yaarsa_email)).not.toBe(ymd(paidUntil));
  });

  it("cliente com dois logins: só o login escolhido é renovado", async () => {
    const db = new FakeDb([monthlyLicense(), lifetimeLicense()]);
    const res = await simulatePaidServerFee(db, panel, {
      targetLicenseId: "lic-monthly",
      paidUntil,
    });

    expect(res.touched).toEqual(["lic-monthly"]);
    expect(db.get("lic-monthly").revoked).toBe(false);
    // O outro login continua exatamente como estava.
    expect(db.get("lic-lifetime").revoked).toBe(true);
    expect(panel.expiryOf("cliente.vitalicio@shadow.test")).toBeNull();
  });

  it("teste grátis nunca entra na renovação de servidor", async () => {
    const trial: Lic = {
      id: "lic-trial",
      is_trial: true,
      plan_slug: "trial",
      yaarsa_email: "trial@shadow.test",
      expires_at: new Date(NOW + DAY).toISOString(),
      revoked: false,
    };
    const db = new FakeDb([trial]);
    const res = await simulatePaidServerFee(db, panel, { paidUntil });
    expect(res.touched).toEqual([]);
    expect(panel.calls).toHaveLength(0);
  });

  it("licença pausada não é despausada pelo pagamento do servidor", async () => {
    const paused = monthlyLicense({
      id: "lic-paused",
      suspended_at: new Date(NOW - 3 * DAY).toISOString(),
      expires_at_before_suspend: new Date(NOW + 10 * DAY).toISOString(),
      revoked: false,
      status: "suspended",
    });
    const db = new FakeDb([paused]);
    await simulatePaidServerFee(db, panel, { paidUntil });
    const lic = db.get("lic-paused");

    expect(lic.status).toBe("suspended");
    expect(new Date(lic.server_paid_until).getTime()).toBe(paidUntil.getTime());
    const after = licenseExpiryState(lic as any, NOW);
    expect(after.paused).toBe(true);
    expect(after.active).toBe(false);
  });

  it("painel offline: o banco é atualizado e a falha é reportada para retry", async () => {
    const db = new FakeDb([monthlyLicense()]);
    panel.offline = true;
    const res = await simulatePaidServerFee(db, panel, { paidUntil });

    expect(res.failures).toHaveLength(1);
    // O cliente pagou: o acesso é liberado no site mesmo com o painel fora.
    expect(db.get("lic-monthly").revoked).toBe(false);
    expect(db.get("lic-monthly").status).toBe("active");
  });

  it("pagar duas vezes seguidas é idempotente (mesma data final)", async () => {
    const db = new FakeDb([monthlyLicense()]);
    await simulatePaidServerFee(db, panel, { paidUntil });
    const first = { ...db.get("lic-monthly") };
    await simulatePaidServerFee(db, panel, { paidUntil });
    const second = db.get("lic-monthly");

    expect(second.expires_at).toBe(first.expires_at);
    expect(second.server_paid_until).toBe(first.server_paid_until);
  });

  it("o corte do servidor é sempre um dia 20 no futuro", () => {
    const d = nextDay20();
    expect(d.getDate()).toBe(20);
    expect(d.getTime()).toBeGreaterThan(Date.now());
  });
});
