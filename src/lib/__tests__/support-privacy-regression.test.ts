import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "33333333-3333-4333-8333-333333333333",
  threadId: "11111111-1111-4111-8111-111111111111",
  ownerId: "44444444-4444-4444-8444-444444444444",
  unread: 4,
  authenticatedError: { code: "PGRST108", message: "schema cache" },
  privilegedError: null as null | { message: string },
  filters: [] as Array<[string, unknown]>,
  sign: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      middleware: () => chain,
      validator: () => chain,
      inputValidator: () => chain,
      handler: (handler: unknown) => handler,
    };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("../tutorials.functions", () => ({ trackSchemaFailure: vi.fn() }));
vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("../gemini-provider.server", () => ({ createGeminiProvider: vi.fn() }));
vi.mock("../admin-helpers.server", () => ({
  assertStaff: vi.fn(), assertAdmin: vi.fn(), resolveOrInviteUser: vi.fn(),
}));
vi.mock("@/lib/storage-gateway.server", () => ({ createDownload: state.sign }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => {
      const filters: Array<[string, unknown]> = [];
      let updating = false;
      const chain = {
        select: () => chain,
        update: () => { updating = true; return chain; },
        eq: (key: string, value: unknown) => { filters.push([key, value]); return chain; },
        maybeSingle: async () => ({
          data: { id: state.threadId, user_id: state.ownerId }, error: null,
        }),
        then: (resolve: (result: unknown) => unknown) => {
          state.filters = filters;
          const matches = filters.every(([key, value]) =>
            key === "id" ? value === state.threadId : key === "user_id" && value === state.ownerId,
          );
          if (updating && matches && !state.privilegedError) state.unread = 0;
          return Promise.resolve(resolve({ error: state.privilegedError }));
        },
      };
      return chain;
    },
  },
}));

import { markThreadReadByCustomer } from "../support.functions";
import { adminSendMessage } from "../admin.functions";

type Handler = (input: { data: Record<string, unknown>; context: { userId: string; supabase: unknown } }) => Promise<unknown>;
const markRead = markThreadReadByCustomer as unknown as Handler;
const sendAdmin = adminSendMessage as unknown as Handler;

function context() {
  return {
    userId: state.userId,
    supabase: {
      from: () => {
        const chain = {
          update: () => chain,
          eq: () => chain,
          then: (resolve: (result: unknown) => unknown) => Promise.resolve(resolve({ error: state.authenticatedError })),
        };
        return chain;
      },
    },
  };
}

beforeEach(() => {
  state.ownerId = "44444444-4444-4444-8444-444444444444";
  state.unread = 4;
  state.authenticatedError = { code: "PGRST108", message: "schema cache" };
  state.privilegedError = null;
  state.filters = [];
  state.sign.mockReset();
});

describe("customer read-state privacy", () => {
  it("does not clear unread counts in somebody else's thread during fallback", async () => {
    await markRead({ data: { threadId: state.threadId }, context: context() });
    expect(state.unread).toBe(4);
    expect(state.filters).toContainEqual(["user_id", state.userId]);
  });
  it("can clear the authenticated owner's unread count during fallback", async () => {
    state.ownerId = state.userId;
    await markRead({ data: { threadId: state.threadId }, context: context() });
    expect(state.unread).toBe(0);
  });
  it("does not announce success when the fallback write fails", async () => {
    state.privilegedError = { message: "unavailable" };
    await expect(markRead({ data: { threadId: state.threadId }, context: context() })).rejects.toThrow();
    expect(state.unread).toBe(4);
  });
  it("does not announce success for unrelated database errors", async () => {
    state.authenticatedError = { code: "42501", message: "permission denied" };
    await expect(markRead({ data: { threadId: state.threadId }, context: context() })).rejects.toThrow();
  });
});

describe("admin attachment privacy", () => {
  it("rejects another conversation's attachment before privileged signing", async () => {
    await expect(sendAdmin({
      data: { threadId: state.threadId, attachmentPath: "staff/22222222-2222-4222-8222-222222222222/print.png" },
      context: context(),
    })).rejects.toThrow("Anexo não pertence a esta conversa.");
    expect(state.sign).not.toHaveBeenCalled();
  });
  it("rejects unrelated customer files before privileged signing", async () => {
    await expect(sendAdmin({
      data: { threadId: state.threadId, attachmentPath: `someone-else/${state.threadId}/print.png` },
      context: context(),
    })).rejects.toThrow("Anexo não pertence a esta conversa.");
    expect(state.sign).not.toHaveBeenCalled();
  });
});
