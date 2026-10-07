import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
const { extendWithPost } = await import("../lib/yaarsa.server");

/** Painel simulado com as regras exatas do createacc.php (add/remove/cexpire). */
function makePanel(acc: { expire: string; subtype: string } | null) {
  const today = new Date().toISOString().slice(0, 10);
  const calls: string[] = [];
  const post = async (f: Record<string, string>) => {
    calls.push(f.action);
    if (!acc) return { Fail: "cant find this email." };
    if (f.action === "add") {
      if (today >= acc.expire) { acc.expire = f.expire_date; acc.subtype = f.subtype; return { Fail: "\"subscription Updated.\"" }; }
      return { Fail: "this email is already in use and active." };
    }
    if (f.action === "remove") { acc.expire = today; acc.subtype = "new"; return { Success: "Client removed successfully!" }; }
    if (f.action === "cexpire") { acc.expire = f.expire_date; return { Success: "Expire Date updated successfully!" }; }
    return { Fail: "?" };
  };
  return { post, calls, acc };
}
const future = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
const noSleep = { sleep: async () => {} };

describe("renovação no painel (status + data)", () => {
  it("conta presa como 'new' com data futura: renova o status e fica ativa", async () => {
    const p = makePanel({ expire: "2099-01-01", subtype: "new" });
    const r = await extendWithPost(p.post, "a@b.c", future, "k", noSleep);
    expect(String(r.Success)).toMatch(/updated successfully/i);
    expect(p.acc!.subtype).toBe("12 Month");
    expect(p.acc!.expire).toBe(future);
  });

  it("conta vencida: reativa direto, sem remove", async () => {
    const p = makePanel({ expire: "2020-01-01", subtype: "new" });
    await extendWithPost(p.post, "a@b.c", future, "k", noSleep);
    expect(p.calls).toEqual(["add"]);
    expect(p.acc!.subtype).toBe("12 Month");
  });

  it("conta inexistente: não cria nada", async () => {
    const p = makePanel(null);
    const r = await extendWithPost(p.post, "a@b.c", future, "k", noSleep);
    expect(r.Success).toBeFalsy();
  });
});
