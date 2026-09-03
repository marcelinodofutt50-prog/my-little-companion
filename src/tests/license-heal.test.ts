import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Testes de ponta a ponta do motor de correção de login (BTmob/Yaarsa),
 * usado pelo botão "Corrigir Erros" do cliente e "Corrigir Bugs" do admin.
 */

const state = {
  create: [] as any[],
  removed: [] as string[],
  extended: [] as any[],
  updates: [] as any[],
  logs: [] as any[],
  createResponses: [] as any[],
  probeResponses: [] as any[],
};

const supabaseAdmin = {
  from: (table: string) => ({
    insert: (row: any) => {
      state.logs.push({ table, row });
      return Promise.resolve({ error: null });
    },
    update: (patch: any) => ({
      eq: (_c: string, id: string) => {
        state.updates.push({ id, patch });
        return Promise.resolve({ error: null });
      },
    }),
  }),
};

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin }));

vi.mock("../lib/yaarsa.server", () => ({
  yaarsaCreateAccount: vi.fn(async (input: any) => {
    state.create.push(input);
    return state.createResponses.shift() ?? { Success: true };
  }),
  yaarsaRemoveAccount: vi.fn(async (email: string) => {
    state.removed.push(email);
    return { Success: true };
  }),
  yaarsaExtend: vi.fn(async (email: string, ymd: string) => {
    state.extended.push({ email, ymd });
    return { Success: true };
  }),
  yaarsaProbeAccount: vi.fn(async () => state.probeResponses.shift() ?? { state: "found", detail: "" }),
  hasPanelServer: () => true,
  isPanelHealthy: () => true,
  refreshPanelOverrides: async () => {},
  generateCredentials: () => ({ username: "shadow_new", email: "shadow_new@shadow.app", password: "Nv#2026abc" }),
  encrypt: (v: string) => `enc:${v}`,
  decrypt: (v: string) => String(v).replace(/^enc:/, ""),
}));

const { healLicenseLogin } = await import("../lib/license-heal.server");

const baseLic = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  plan_slug: "monthly_457",
  yaarsa_username: "cliente1",
  yaarsa_email: "cliente1@shadow.app",
  yaarsa_password_enc: "enc:Antiga#123",
  panel: "v457",
  expires_at: new Date(Date.now() + 20 * 864e5).toISOString(),
  is_trial: false,
  server_ip: null,
};

beforeEach(() => {
  state.create = [];
  state.removed = [];
  state.extended = [];
  state.updates = [];
  state.logs = [];
  state.createResponses = [];
  state.probeResponses = [];
});

describe("healLicenseLogin", () => {
  it("cria a conta quando ela não existe no painel, mantendo e-mail e senha do cliente", async () => {
    state.createResponses = [{ Success: true }];
    const res = await healLicenseLogin(baseLic, { reason: "test" });

    expect(res.action).toBe("created");
    expect(res.credentials.email).toBe("cliente1@shadow.app");
    expect(res.credentials.password).toBe("Antiga#123");
    expect(state.removed).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
    expect(state.extended[0]?.email).toBe("cliente1@shadow.app");
  });

  it("apaga e recria com AS MESMAS credenciais quando o e-mail já existe", async () => {
    state.createResponses = [{ Fail: "1004 email already in use" }, { Success: true }];
    const res = await healLicenseLogin(baseLic, { reason: "test" });

    expect(res.action).toBe("recreated");
    expect(state.removed).toContain("cliente1@shadow.app");
    expect(res.credentials.email).toBe("cliente1@shadow.app");
    expect(res.credentials.password).toBe("Antiga#123");
    expect(state.create[1].email).toBe("cliente1@shadow.app");
    expect(state.create[1].password).toBe("Antiga#123");
    expect(state.updates[0]?.patch.yaarsa_email).toBe("cliente1@shadow.app");
    expect(state.updates[0]?.patch.revoked).toBe(false);
  });

  it("falha em vez de dizer que corrigiu quando a conta não aparece no painel", async () => {
    state.createResponses = [{ Success: true }];
    state.probeResponses = [{ state: "missing", detail: "" }];
    await expect(healLicenseLogin(baseLic, { reason: "test" })).rejects.toThrow(/não aparece no painel/i);
    expect(state.updates).toHaveLength(0);
  });

  it("não apaga nada quando o painel está fora do ar", async () => {
    state.createResponses = [{ Fail: "connection timeout" }];
    await expect(healLicenseLogin(baseLic, { reason: "test" })).rejects.toThrow(/não respondeu/i);
    expect(state.removed).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
  });

  it("força a recriação quando pedido explicitamente", async () => {
    state.createResponses = [{ Success: true }];
    const res = await healLicenseLogin(baseLic, { reason: "test", forceRecreate: true });

    expect(res.action).toBe("recreated");
    expect(state.removed).toContain("cliente1@shadow.app");
    expect(state.create).toHaveLength(1);
    expect(state.create[0].email).toBe("cliente1@shadow.app");
  });

  it("emite login novo quando a licença não tem senha guardada", async () => {
    state.createResponses = [{ Success: true }];
    const res = await healLicenseLogin({ ...baseLic, yaarsa_password_enc: null }, { reason: "test" });
    expect(res.action).toBe("recreated");
    expect(res.credentials.email).toBe("shadow_new@shadow.app");
    expect(res.steps).toContain("sem-senha-guardada:credenciais-novas");
  });

  it("tenta outro painel quando o preferido está com a cota cheia", async () => {
    state.createResponses = [
      { Fail: "1004 already in use" },
      { Fail: "maximum allowed accounts reached" },
      { Success: true },
    ];
    const res = await healLicenseLogin(baseLic, { reason: "test" });
    expect(res.action).toBe("recreated");
    expect(res.steps.some((s) => s.startsWith("login-recriado-em:"))).toBe(true);
    expect(res.credentials.email).toBe("cliente1@shadow.app");
  });

  it("preserva o acesso atual quando todos os painéis estão cheios", async () => {
    state.createResponses = [
      { Fail: "1004 already in use" },
      { Fail: "maximum allowed accounts reached" },
      { Fail: "maximum allowed accounts reached" },
      { Fail: "maximum allowed accounts reached" },
    ];
    await expect(healLicenseLogin(baseLic, { reason: "test" })).rejects.toThrow(/cota de contas cheia/i);
    expect(state.updates).toEqual([]);
  });
});
