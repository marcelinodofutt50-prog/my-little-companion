import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectTrialMisconduct } from "../trial-misconduct";

const state: { licenses: any[]; updates: any[]; audits: any[]; systemMessages: string[] } = {
  licenses: [],
  updates: [],
  audits: [],
  systemMessages: [],
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "licenses") {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: state.licenses, error: null }) }),
          update: (payload: any) => ({
            eq: (_c: string, id: string) => {
              state.updates.push({ id, ...payload });
              return Promise.resolve({ error: null });
            },
          }),
        } as any;
      }
      return {
        insert: (payload: any) => {
          state.audits.push(payload);
          return Promise.resolve({ error: null });
        },
      } as any;
    },
  },
}));

vi.mock("../yaarsa.server", () => ({
  yaarsaRemoveAccount: vi.fn().mockResolvedValue({ Success: true }),
}));

vi.mock("../support-system-message.server", () => ({
  postSystemSupportMessage: vi.fn(async (_t: string, body: string) => {
    state.systemMessages.push(body);
    return { success: true };
  }),
}));

const { enforceTrialConduct } = await import("../trial-misconduct.server");

const trial = (over: any = {}) => ({
  id: "trial-1",
  is_trial: true,
  revoked: false,
  disabled_at: null,
  expires_at: new Date(Date.now() + 86400000).toISOString(),
  yaarsa_email: "t@t.com",
  panel: "v457",
  ...over,
});

describe("detectTrialMisconduct", () => {
  it("flags installing on third parties", () => {
    for (const m of [
      "não estou conseguindo instalar na pena",
      "tenho muita pena para colocar",
      "como boto no bico do meu amigo",
      "quero revender esse app",
      "instalei nos meus clientes e deu erro",
      "coloquei nas penas e não abriu",
    ]) {
      expect(detectTrialMisconduct(m).flagged, m).toBe(true);
    }
  });

  it("does not flag legitimate customers", () => {
    for (const m of [
      "que pena, não consegui logar",
      "vale a pena o plano vitalício?",
      "erro de senha ao entrar no btmob",
      "meu teste expirou, quero comprar",
      "bom dia, tudo bem?",
    ]) {
      expect(detectTrialMisconduct(m).flagged, m).toBe(false);
    }
  });
});

describe("enforceTrialConduct", () => {
  beforeEach(() => {
    state.licenses = [];
    state.updates = [];
    state.audits = [];
    state.systemMessages = [];
  });

  it("ignores clean messages", async () => {
    state.licenses = [trial()];
    const out = await enforceTrialConduct({ threadId: "t1", userId: "u1", message: "bom dia" });
    expect(out.flagged).toBe(false);
    expect(state.updates).toHaveLength(0);
  });

  it("does not punish customers with a paid license", async () => {
    state.licenses = [trial(), trial({ id: "paid-1", is_trial: false })];
    const out = await enforceTrialConduct({
      threadId: "t1",
      userId: "u1",
      message: "não consigo instalar na pena do cliente",
    });
    expect(out.flagged).toBe(true);
    expect(out.hasPaidLicense).toBe(true);
    expect(state.updates).toHaveLength(0);
  });

  it("revokes the trial when there is no purchased login", async () => {
    state.licenses = [trial()];
    const out = await enforceTrialConduct({
      threadId: "t1",
      userId: "u1",
      message: "to tentando instalar na pena e não vai",
    });
    expect(out.revokedLicenseIds).toEqual(["trial-1"]);
    expect(state.updates[0]).toMatchObject({ id: "trial-1", revoked: true, status: "revoked" });
    expect(state.audits[0]).toMatchObject({ event: "trial_revoked_misconduct", decision: "revoked" });
    expect(state.systemMessages[0]).toContain("conduta inadequada");
  });
});
