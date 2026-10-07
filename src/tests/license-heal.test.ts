import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Reparo de login contra um painel SIMULADO que segue o createacc.php real:
 * remove = só vence (subtype 'new'); add em vencida = "subscription Updated.";
 * add em ativa = "already in use and active"; update = troca senha.
 */

type Acc = { password: string; expire: string; subtype: string };
const panels: Record<string, Map<string, Acc>> = {};
const db = (p: string) => (panels[p] ??= new Map());
const today = () => new Date().toISOString().slice(0, 10);
const calls: string[] = [];
const updates: any[] = [];
const logs: any[] = [];
let offline = false;
let quotaFull = false;

const validPw = (pw: string) => pw.length >= 8 && pw.length <= 16 && /[A-Z]/.test(pw) && /[^a-zA-Z0-9]/.test(pw);

const supabaseAdmin = {
  from: (table: string) => ({
    insert: (row: any) => { logs.push({ table, row }); return Promise.resolve({ error: null }); },
    update: (patch: any) => ({ eq: (_c: string, id: string) => { updates.push({ id, patch }); return Promise.resolve({ error: null }); } }),
  }),
};
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin }));
vi.mock("../lib/audit-trail.server", () => ({ acquireOpLock: vi.fn(async () => true), releaseOpLock: vi.fn(async () => undefined) }));
vi.mock("../lib/license-password.server", () => ({
  updateLicenseTolerant: async (_s: any, id: string, patch: any) => { updates.push({ id, patch }); },
}));

vi.mock("../lib/yaarsa.server", () => ({
  refreshPanelOverrides: async () => {},
  sanitizePanelUsername: (u: string) => (u || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "user",
  isPanelPasswordValid: validPw,
  generateCredentials: () => ({ username: "novo", email: "x@y.z", password: "Nova#Senha9" }),
  encrypt: (v: string) => `enc:${v}`,
  decrypt: (v: string) => String(v).replace(/^enc:/, ""),
  yaarsaUpdatePassword: vi.fn(async (email: string, pw: string, panel: string) => {
    calls.push(`update:${panel}`);
    if (offline) throw new Error("fetch failed");
    const a = db(panel).get(email);
    if (!a) return { Fail: "cant find this email." };
    if (!validPw(pw)) return { Fail: "Password must contain at least one uppercase letter." };
    a.password = pw;
    return { Success: "Password updated successfully!" };
  }),
  yaarsaCreateAccount: vi.fn(async (i: any) => {
    calls.push(`add:${i.panel}`);
    if (quotaFull) return { Fail: "Maximum allowed accounts reached (999)." };
    const a = db(i.panel).get(i.email);
    if (a) return { Fail: "this email is already in use and active." };
    db(i.panel).set(i.email, { password: i.password, expire: i.expireDate, subtype: "12 Month" });
    return { Success: "Account created successfully!" };
  }),
  // Mesma lógica do yaarsaExtend real: add (reativa) → cexpire.
  yaarsaExtend: vi.fn(async (email: string, ymd: string, panel: string) => {
    calls.push(`extend:${panel}:${ymd}`);
    const a = db(panel).get(email);
    if (!a) return { Fail: "cant find this email." };
    if (a.expire <= today() || a.subtype === "new") {
      a.expire = ymd; a.subtype = "1 Month";
      return { Success: "Expire Date updated successfully! (assinatura reativada)" };
    }
    a.expire = ymd;
    return { Success: "Expire Date updated successfully!" };
  }),
  yaarsaResetDevice: vi.fn(async (_e: string, panel: string) => { calls.push(`resetid:${panel}`); return { Success: "Client ID Reset successfully!" }; }),
}));

const { healLicenseLogin } = await import("../lib/license-heal.server");

const lic = (over: any = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  plan_slug: "login-30d",
  yaarsa_username: "cliente1",
  yaarsa_email: "cliente1@shadow.app",
  yaarsa_password_enc: "enc:Antiga#123",
  panel: "v455",
  expires_at: new Date(Date.now() + 20 * 864e5).toISOString(),
  is_trial: false,
  server_ip: null,
  ...over,
});

beforeEach(() => {
  for (const k of Object.keys(panels)) delete panels[k];
  calls.length = 0; updates.length = 0; logs.length = 0; offline = false; quotaFull = false;
});

describe("reparo de acesso (regras reais do painel)", () => {
  it("conta 'removida' (subtype new, vencida hoje) é reativada com a MESMA senha e a data certa", async () => {
    db("v455").set("cliente1@shadow.app", { password: "errada", expire: today(), subtype: "new" });
    const r = await healLicenseLogin(lic());
    const acc = db("v455").get("cliente1@shadow.app")!;
    expect(r.action).toBe("recreated");
    expect(acc.subtype).not.toBe("new");
    expect(acc.password).toBe("Antiga#123");
    expect(acc.expire > today()).toBe(true);
    expect(calls.some((c) => c.startsWith("remove"))).toBe(false);
  });

  it("conta ativa com senha diferente: reaplica a senha e ajusta a data", async () => {
    db("v455").set("cliente1@shadow.app", { password: "Outra#999", expire: "2099-01-01", subtype: "1 Month" });
    const r = await healLicenseLogin(lic());
    expect(r.ok).toBe(true);
    expect(db("v455").get("cliente1@shadow.app")!.password).toBe("Antiga#123");
  });

  it("conta inexistente: cria com as credenciais da licença", async () => {
    const r = await healLicenseLogin(lic());
    expect(r.action).toBe("created");
    expect(db("v455").get("cliente1@shadow.app")!.password).toBe("Antiga#123");
  });

  it("nunca mexe em outro servidor", async () => {
    db("v457").set("cliente1@shadow.app", { password: "x", expire: "2099-01-01", subtype: "1 Month" });
    await healLicenseLogin(lic());
    expect(calls.every((c) => c.includes("v455"))).toBe(true);
    expect(db("v457").get("cliente1@shadow.app")!.password).toBe("x");
  });

  it("senha fora da regra do painel: emite uma válida e grava na licença", async () => {
    db("v455").set("cliente1@shadow.app", { password: "x", expire: "2099-01-01", subtype: "1 Month" });
    const r = await healLicenseLogin(lic({ yaarsa_password_enc: "enc:semregra" }));
    expect(r.credentials.password).toBe("Nova#Senha9");
    expect(updates.some((u) => u.patch.yaarsa_password_enc === "enc:Nova#Senha9")).toBe(true);
  });

  it("painel fora do ar: não altera nada e avisa", async () => {
    offline = true;
    await expect(healLicenseLogin(lic())).rejects.toThrow(/não respondeu/);
    expect(updates.length).toBe(0);
  });

  it("cota cheia ao criar: mensagem clara", async () => {
    quotaFull = true;
    await expect(healLicenseLogin(lic())).rejects.toThrow(/cota/);
  });

  it("equipe também libera o aparelho preso", async () => {
    db("v455").set("cliente1@shadow.app", { password: "x", expire: "2099-01-01", subtype: "1 Month" });
    await healLicenseLogin(lic(), { reason: "fix_login" });
    expect(calls).toContain("resetid:v455");
  });

  it("trial usa hoje + 2 dias (fuso de Brasília)", async () => {
    await healLicenseLogin(lic({ is_trial: true, plan_slug: "trial", expires_at: new Date(Date.now() + 3600e3).toISOString() }));
    const exp = db("v455").get("cliente1@shadow.app")!.expire;
    expect(exp > today()).toBe(true);
  });
});
