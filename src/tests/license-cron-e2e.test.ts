import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Teste ponta a ponta dos crons de licença: chama os handlers HTTP reais,
 * com banco e painel simulados, e confere banco + logs + resposta.
 */

type Row = Record<string, any>;

const db = {
  licenses: [] as Row[],
  logs: [] as Row[],
  updates: [] as Array<{ id: string; patch: Row }>,
  rpcRows: [] as Row[],
};

const panel = {
  removed: [] as Array<{ email: string; panel: string }>,
  extended: [] as Array<{ email: string; panel: string; ymd: string }>,
  responses: {} as Record<string, any>,
};

function licenseQuery() {
  let rows = [...db.licenses];
  const api: any = {
    select: () => api,
    is: (col: string, val: any) => {
      rows = rows.filter((r) => (val === null ? (r[col] ?? null) === null : r[col] === val));
      return api;
    },
    not: (col: string, _op: string, _val: any) => {
      rows = rows.filter((r) => (r[col] ?? null) !== null);
      return api;
    },
    neq: (col: string, val: any) => {
      rows = rows.filter((r) => r[col] !== val);
      return api;
    },
    lt: (col: string, val: any) => {
      rows = rows.filter((r) => r[col] && r[col] < val);
      return api;
    },
    gte: (col: string, val: any) => {
      rows = rows.filter((r) => r[col] && r[col] >= val);
      return api;
    },
    eq: (col: string, val: any) => {
      rows = rows.filter((r) => r[col] === val);
      return api;
    },
    limit: () => Promise.resolve({ data: rows, error: null }),
    then: (res: any) => Promise.resolve({ data: rows, error: null }).then(res),
  };
  return api;
}

const supabaseAdmin: any = {
  from(table: string) {
    if (table === "integration_logs") {
      return {
        insert: (payload: any) => {
          db.logs.push(...(Array.isArray(payload) ? payload : [payload]));
          return Promise.resolve({ error: null });
        },
      };
    }
    return {
      ...licenseQuery(),
      update: (patch: Row) => ({
        eq: (_c: string, id: string) => {
          db.updates.push({ id, patch });
          const row = db.licenses.find((l) => l.id === id);
          if (row) Object.assign(row, patch);
          return Promise.resolve({ error: null });
        },
      }),
    };
  },
  rpc: async () => ({ data: db.rpcRows, error: null }),
};

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin }));
vi.mock("@/lib/cron-auth.server", () => ({ cronUnauthorized: () => null }));
const yaarsaMock = {
  ALL_PANELS: ["v455", "v457", "v46"],
  hasPanelServer: () => true,
  refreshPanelOverrides: async () => {},
  yaarsaRemoveAccount: async (email: string, p: string) => {
    panel.removed.push({ email, panel: p });
    return panel.responses[p] ?? { Success: true };
  },
  yaarsaExtend: async (email: string, ymd: string, p: string) => {
    panel.extended.push({ email, panel: p, ymd });
    return panel.responses[p] ?? { Success: true };
  },
};
vi.mock("../lib/yaarsa.server", () => yaarsaMock);
vi.mock("@/lib/yaarsa.server", () => yaarsaMock);

const { Route: expireRoute } = await import("../routes/api/public/hooks/expire-licenses");
const { Route: dailyRoute } = await import("../routes/api/public/hooks/daily-license-check");

const expirePost = (expireRoute as any).options.server.handlers.POST;
const dailyPost = (dailyRoute as any).options.server.handlers.POST;
const req = () => new Request("http://localhost/api/public/hooks/x", { method: "POST" });

beforeEach(() => {
  db.licenses = [];
  db.logs = [];
  db.updates = [];
  db.rpcRows = [];
  panel.removed = [];
  panel.extended = [];
  panel.responses = {};
});

const past = new Date(Date.now() - 3600_000).toISOString();
const future = new Date(Date.now() + 86400_000).toISOString();

describe("cron de vencimento (ponta a ponta)", () => {
  it("remove a conta vencida no painel e fecha a licença no banco", async () => {
    db.licenses.push({
      id: "lic-1", user_id: "u1", plan_slug: "login-30d", is_trial: false,
      yaarsa_email: "cliente@shadow.app", panel: "v457",
      disabled_at: null, revoked: false, expires_at: past,
    });

    const res = await expirePost({ request: req() });
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.checked).toBe(1);
    expect(body.removed).toBe(1);
    expect(panel.removed[0]).toEqual({ email: "cliente@shadow.app", panel: "v457" });
    expect(db.licenses[0]!.revoked).toBe(true);
    expect(db.licenses[0]!.disabled_at).toBeTruthy();
    expect(db.logs.some((l) => l.outcome === "removed")).toBe(true);
  });

  it("não toca em licença vitalícia nem em licença ainda válida", async () => {
    db.licenses.push(
      { id: "life", user_id: "u1", plan_slug: "login-lifetime", yaarsa_email: "a@a.com", panel: "v457", disabled_at: null, revoked: false, expires_at: past },
      { id: "ok", user_id: "u2", plan_slug: "login-30d", yaarsa_email: "b@b.com", panel: "v457", disabled_at: null, revoked: false, expires_at: future },
    );
    const body = await (await expirePost({ request: req() })).json();
    expect(body.checked).toBe(0);
    expect(panel.removed).toHaveLength(0);
    expect(db.updates).toHaveLength(0);
  });

  it("procura em todos os painéis quando a conta não está no painel gravado", async () => {
    panel.responses["v457"] = { Fail: "1005 cant find this email" };
    db.licenses.push({
      id: "lic-2", user_id: "u1", plan_slug: "trial", is_trial: true,
      yaarsa_email: "trial@shadow.app", panel: "v457",
      disabled_at: null, revoked: false, expires_at: past,
    });
    const body = await (await expirePost({ request: req() })).json();
    expect(body.removed).toBe(1);
    expect(panel.removed.map((r) => r.panel)).toEqual(["v457", "v455"]);
  });

  it("fecha no banco e marca pendência quando todos os painéis falham", async () => {
    for (const p of ["v455", "v457", "v46"]) panel.responses[p] = { Fail: "connection timeout" };
    db.licenses.push({
      id: "lic-3", user_id: "u1", plan_slug: "login-7d", is_trial: false,
      yaarsa_email: "offline@shadow.app", panel: "v46",
      disabled_at: null, revoked: false, expires_at: past,
    });
    const body = await (await expirePost({ request: req() })).json();
    expect(body.removed).toBe(0);
    expect(body.pending_panel).toBe(1);
    expect(db.licenses[0]!.revoked).toBe(true);
    expect(db.logs.some((l) => l.outcome === "removed_yaarsa_failed")).toBe(true);
  });
});

describe("cron diário de inadimplência (ponta a ponta)", () => {
  it("suspende no painel as licenças revogadas pelo banco", async () => {
    db.rpcRows = [{ id: "l1", user_id: "u1", yaarsa_email: "atraso@shadow.app", panel: "v455" }];
    const body = await (await dailyPost({ request: req() })).json();
    expect(body).toMatchObject({ ok: true, revoked: 1, yaarsa_suspended: 1 });
    expect(panel.extended[0]!.panel).toBe("v455");
    expect(db.logs.some((l) => l.outcome === "revoked")).toBe(true);
  });

  it("registra falha sem fingir suspensão quando o painel está fora do ar", async () => {
    for (const p of ["v455", "v457", "v46"]) panel.responses[p] = { Fail: "504 gateway" };
    db.rpcRows = [{ id: "l2", user_id: "u2", yaarsa_email: "x@shadow.app", panel: "v457" }];
    const body = await (await dailyPost({ request: req() })).json();
    expect(body.yaarsa_suspended).toBe(0);
    expect(db.logs.some((l) => l.outcome === "revoked_yaarsa_failed")).toBe(true);
  });
});
