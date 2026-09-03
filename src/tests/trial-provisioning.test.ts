import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Garante que nunca gravamos uma licença de teste quando o painel não
 * confirmou a criação da conta (limite de contas ou painel fora do ar).
 */

const yaarsaCreateAccount = vi.fn();
const inserted: Record<string, any[]> = {};

vi.mock("@/lib/yaarsa.server", () => ({
  yaarsaCreateAccount: (...a: any[]) => yaarsaCreateAccount(...a),
  deriveCredentials: () => ({ username: "u1", email: "u1@shadow.dev", password: "Aa1!aaaa" }),
  encrypt: (v: string) => `enc:${v}`,
  decrypt: (v: string) => String(v).replace("enc:", ""),
  expireDateFor: () => "2030-01-01",
  resolveTrialPanel: async () => "v455",
  ALL_PANELS: ["v455", "v457", "v46"],
  hasPanelServer: () => true,
}));

function makeAdmin() {
  const api = {
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }), maybeSingle: async () => ({ data: null }) }),
        }),
        insert: (payload: any) => {
          (inserted[table] ||= []).push(payload);
          return {
            select: () => ({ maybeSingle: async () => ({ data: { id: "lic1", ...payload }, error: null }) }),
            then: (r: any) => r({ error: null }),
          } as any;
        },
        update: () => ({ eq: async () => ({ error: null }) }),
        delete: () => ({ eq: () => ({ is: async () => ({ error: null }) }) }),
      } as any;
    },
  };
  return api as any;
}

async function run() {
  const { internalGenerateTrial } = await import("@/lib/license.server");
  return internalGenerateTrial(makeAdmin(), "user-1", 1);
}

describe("provisionamento de teste grátis", () => {
  beforeEach(() => {
    yaarsaCreateAccount.mockReset();
    for (const k of Object.keys(inserted)) delete inserted[k];
  });

  it("não cria licença quando todos os painéis estão sem vaga", async () => {
    yaarsaCreateAccount.mockResolvedValue({ Fail: "maximum allowed accounts reached" });
    await expect(run()).rejects.toThrow(/cota de contas cheia/i);
    expect(inserted["licenses"]).toBeUndefined();
  });

  it("não cria licença quando o painel não responde", { timeout: 30000 }, async () => {
    yaarsaCreateAccount.mockRejectedValue(new Error("network timeout"));
    await expect(run()).rejects.toThrow(/Nenhuma licença foi gerada/i);
    expect(inserted["licenses"]).toBeUndefined();
  });

  it("faz failover para outro painel quando o primeiro está cheio", async () => {
    yaarsaCreateAccount
      .mockResolvedValueOnce({ Fail: "maximum allowed accounts reached" })
      .mockResolvedValueOnce({ Success: "ok" });
    const r = await run();
    expect(r.id).toBe("lic1");
    expect(inserted["licenses"]?.[0]?.panel).toBe("v457");
  });

  it("aceita conta já existente no painel", async () => {
    yaarsaCreateAccount.mockResolvedValue({ Fail: "1004 email already exist" });
    const r = await run();
    expect(r.retried).toBe(true);
    expect(inserted["licenses"]).toHaveLength(1);
  });
});
