import { describe, it, expect, vi, beforeEach } from "vitest";

/** Varredura de painéis usada pelos crons de vencimento/inadimplência. */

const calls: Array<{ fn: string; email: string; panel: string }> = [];
const responses: Record<string, any> = {};

vi.mock("../lib/yaarsa.server", () => ({
  ALL_PANELS: ["v455", "v457", "v46"],
  hasPanelServer: () => true,
  refreshPanelOverrides: async () => {},
  yaarsaRemoveAccount: vi.fn(async (email: string, panel: string) => {
    calls.push({ fn: "remove", email, panel });
    return responses[panel] ?? { Success: true };
  }),
  yaarsaExtend: vi.fn(async (email: string, _ymd: string, panel: string) => {
    calls.push({ fn: "extend", email, panel });
    return responses[panel] ?? { Success: true };
  }),
}));

const { removeAccountAnyPanel, suspendAccountAnyPanel, panelOrder } = await import(
  "../lib/license-cron.server"
);

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(responses)) delete responses[k];
});

describe("varredura de painéis dos crons", () => {
  it("tenta primeiro o painel gravado na licença", () => {
    expect(panelOrder("v46")).toEqual(["v46", "v455", "v457"]);
    expect(panelOrder(null)).toEqual(["v457", "v455", "v46"]);
  });

  it("remove no painel v455 mesmo quando a licença não diz o painel", async () => {
    responses["v457"] = { Fail: "1005 cant find this email" };
    responses["v455"] = { Success: true };
    const res = await removeAccountAnyPanel("cliente@shadow.app", null);
    expect(res.status).toBe("done");
    expect(res.panel).toBe("v455");
  });

  it("marca como ausente quando a conta não existe em painel nenhum", async () => {
    responses["v455"] = { Fail: "1005 not found" };
    responses["v457"] = { Fail: "1005 not found" };
    responses["v46"] = { Fail: "1005 not found" };
    const res = await removeAccountAnyPanel("sumiu@shadow.app", "v457");
    expect(res.status).toBe("missing");
    expect(res.tried).toHaveLength(3);
  });

  it("não finge sucesso quando o painel está fora do ar", async () => {
    responses["v455"] = { Fail: "connection timeout" };
    responses["v457"] = { Fail: "connection timeout" };
    responses["v46"] = { Fail: "connection timeout" };
    const res = await removeAccountAnyPanel("cliente@shadow.app", "v455");
    expect(res.status).toBe("failed");
    expect(res.error).toMatch(/timeout/i);
  });

  it("suspende a conta procurando em todos os painéis", async () => {
    responses["v457"] = { Fail: "1005 cant find this email" };
    const res = await suspendAccountAnyPanel("atrasado@shadow.app", "v457", "2026-09-04");
    expect(res.status).toBe("done");
    expect(calls[0]?.panel).toBe("v457");
    expect(calls[1]?.panel).toBe("v455");
  });
});
