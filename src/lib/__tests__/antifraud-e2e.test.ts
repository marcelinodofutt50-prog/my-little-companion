/**
 * E2E de conduta/antifraude do teste grátis.
 *
 * Cobre a fronteira que mais importa para o negócio:
 *  - evidência INEQUÍVOCA  -> revoga o trial automaticamente
 *  - evidência AMBÍGUA     -> apenas registra revisão, NUNCA bloqueia
 *  - cliente pago          -> nunca é punido
 *
 * Nada aqui toca no fluxo de emissão de trial/bypass: apenas a política de conduta.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
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

const trialLicense = (over: any = {}) => ({
  id: "trial-1",
  is_trial: true,
  revoked: false,
  disabled_at: null,
  expires_at: new Date(Date.now() + 86400000).toISOString(),
  yaarsa_email: "t@t.com",
  panel: "v457",
  ...over,
});

/** Mensagens que declaram uso em terceiros de forma inequívoca. */
const UNEQUIVOCAL = [
  "consegui instalar na pena do cara mas travou",
  "coloquei nas penas e nao abriu",
  "vou botar no bico do meu amigo, como faz?",
  "quero revender o acesso pra uns amigos",
  "instalei nos meus clientes e deu erro de licenca",
  "posso passar o login pros meus clientes usarem o app?",
];

/** Mensagens ambíguas ou 100% legítimas — jamais podem revogar nada. */
const AMBIGUOUS_OR_LEGIT = [
  "que pena, nao consegui logar hoje",
  "vale a pena o plano vitalicio?",
  "sou cliente novo aqui, como instalo o apk?",
  "instalei o app no meu celular e travou na tela inicial",
  "meus clientes reclamaram do meu atendimento, nada a ver com voces",
  "bom dia, tudo bem? preciso de ajuda com o pix",
  "meu teste expirou, quero comprar o mensal",
  "falaram de uma pena aqui no grupo do telegram",
];

describe("antifraude E2E — classificação de mensagens", () => {
  it("classifica evidência inequívoca como acionável", () => {
    for (const m of UNEQUIVOCAL) {
      const r = detectTrialMisconduct(m);
      expect(r.flagged, m).toBe(true);
      expect(r.actionable, m).toBe(true);
      expect(r.confidence, m).toBe("high");
    }
  });

  it("nunca marca cliente legítimo/ambíguo como acionável", () => {
    for (const m of AMBIGUOUS_OR_LEGIT) {
      const r = detectTrialMisconduct(m);
      expect(r.actionable, m).toBe(false);
      expect(r.confidence, m).not.toBe("high");
    }
  });
});

describe("antifraude E2E — efeito real no trial", () => {
  beforeEach(() => {
    state.licenses = [trialLicense()];
    state.updates = [];
    state.audits = [];
    state.systemMessages = [];
  });

  it("revoga somente com evidência inequívoca", async () => {
    for (const message of UNEQUIVOCAL) {
      state.licenses = [trialLicense()];
      state.updates = [];
      const out = await enforceTrialConduct({ threadId: "t1", userId: "u1", message });
      expect(out.actionable, message).toBe(true);
      expect(out.revokedLicenseIds, message).toEqual(["trial-1"]);
      expect(state.updates[0], message).toMatchObject({ revoked: true, status: "revoked" });
    }
  });

  it("mensagens ambíguas entram em revisão sem bloquear o cliente", async () => {
    for (const message of AMBIGUOUS_OR_LEGIT) {
      state.licenses = [trialLicense()];
      state.updates = [];
      state.audits = [];
      const out = await enforceTrialConduct({ threadId: "t1", userId: "u1", message });
      expect(out.revokedLicenseIds, message).toEqual([]);
      expect(state.updates, message).toHaveLength(0);
      if (out.flagged) {
        expect(out.confidence, message).toBe("review");
        expect(state.audits[0]?.event, message).toBe("trial_misconduct_review");
      }
    }
  });

  it("cliente com licença paga (mesmo expirada) nunca é revogado", async () => {
    state.licenses = [
      trialLicense(),
      trialLicense({ id: "paid-old", is_trial: false, expires_at: new Date(Date.now() - 86400000).toISOString() }),
    ];
    const out = await enforceTrialConduct({
      threadId: "t1",
      userId: "u1",
      message: "instalei nos meus clientes e deu erro de licenca",
    });
    expect(out.hasPaidLicense).toBe(true);
    expect(state.updates).toHaveLength(0);
  });

  it("notifica o cliente e registra auditoria ao revogar", async () => {
    const out = await enforceTrialConduct({
      threadId: "t1",
      userId: "u1",
      message: "vou botar no bico do meu amigo, como faz?",
    });
    expect(out.revokedLicenseIds).toEqual(["trial-1"]);
    expect(state.audits[0]).toMatchObject({ event: "trial_revoked_misconduct", decision: "revoked" });
    expect(state.systemMessages[0]).toContain("conduta inadequada");
  });
});
