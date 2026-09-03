import { describe, it, expect } from "vitest";
import { generatePin, normalizePin, verifyAndConsumePin, getOrCreatePin } from "@/lib/security-pin.server";

function fakeAdmin(initial: any) {
  const state: any = { row: initial, updates: [] as any[], inserts: [] as any[] };
  const admin = {
    from() {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.row }) }) }),
        update: (patch: any) => ({
          eq: async () => {
            state.updates.push(patch);
            state.row = { ...state.row, ...patch };
            return { error: null };
          },
        }),
        upsert: async (row: any) => {
          state.inserts.push(row);
          state.row = { ...(state.row ?? {}), ...row };
          return { error: null };
        },
      };
    },
  };
  return { admin, state };
}

describe("PIN de segurança", () => {
  it("gera PIN legível e normaliza a comparação", () => {
    const pin = generatePin();
    expect(pin).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(normalizePin("ab cd-2345")).toBe("ABCD2345");
  });

  it("cria o PIN quando o cliente ainda não tem", async () => {
    const { admin, state } = fakeAdmin(null);
    const res = await getOrCreatePin(admin, "u1");
    expect(res.pin).toBeTruthy();
    expect(state.inserts).toHaveLength(1);
  });

  it("recusa PIN errado sem queimar o atual", async () => {
    const { admin, state } = fakeAdmin({ pin: "ABCD-2345", uses_count: 0 });
    const res = await verifyAndConsumePin(admin, "u1", "ZZZZ-9999");
    expect(res.ok).toBe(false);
    expect(state.updates).toHaveLength(0);
  });

  it("aceita PIN correto e troca por um novo na hora", async () => {
    const { admin, state } = fakeAdmin({ pin: "ABCD-2345", uses_count: 1 });
    const res = await verifyAndConsumePin(admin, "u1", "abcd2345");
    expect(res.ok).toBe(true);
    expect(state.updates[0].pin).not.toBe("ABCD-2345");
    expect(state.updates[0].uses_count).toBe(2);
    // o PIN antigo não vale mais
    const again = await verifyAndConsumePin(admin, "u1", "ABCD-2345");
    expect(again.ok).toBe(false);
  });

  it("avisa quando o cliente não tem PIN gerado", async () => {
    const { admin } = fakeAdmin(null);
    const res = await verifyAndConsumePin(admin, "u1", "ABCD-2345");
    expect(res).toEqual({ ok: false, reason: "no_pin" });
  });
});
