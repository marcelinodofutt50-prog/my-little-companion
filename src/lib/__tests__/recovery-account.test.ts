import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  recordAttempt: vi.fn(),
  hashCode: vi.fn(),
  from: vi.fn(),
  updateUserById: vi.fn(),
  listFactors: vi.fn(),
  deleteFactor: vi.fn(),
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
vi.mock("@/lib/rate-limit.server", () => ({ checkRateLimit: mocks.checkRateLimit, recordAttempt: mocks.recordAttempt }));
vi.mock("@/lib/antifraud.server", () => ({ maskEmail: () => "masked" }));
vi.mock("@/lib/recovery.server", () => ({ hashCode: mocks.hashCode }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: mocks.from,
    auth: { admin: {
      updateUserById: mocks.updateUserById,
      mfa: { listFactors: mocks.listFactors, deleteFactor: mocks.deleteFactor },
    } },
  },
}));

import { recoverAccountWithCode } from "../recovery.functions";

type Handler = (input: { data: { email: string; code: string; newPassword: string } }) => Promise<{
  ok: boolean; codesRemaining: number; mfaRemoved: number; warning: string | null;
}>;
const recover = recoverAccountWithCode as unknown as Handler;
const input = { data: { email: "cliente@example.com", code: "SHDW-AAAA-BBBB", newPassword: "nova-senha-segura" } };

let codeUsedAt: string | null;
let trustedDeleted: boolean;
let updateError: { message: string } | null;

function from(table: string) {
  if (table === "profiles") {
    const chain = {
      select: () => chain,
      ilike: () => chain,
      maybeSingle: async () => ({ data: { id: "user-1" }, error: null }),
    };
    return chain;
  }
  if (table === "mfa_trusted_devices") {
    const chain = {
      delete: () => chain,
      eq: () => chain,
      then(resolve: (value: unknown) => unknown) {
        trustedDeleted = true;
        return Promise.resolve(resolve({ error: null }));
      },
    };
    return chain;
  }
  if (table !== "recovery_codes") throw new Error(`unexpected table ${table}`);

  let values: { used_at: string | null } | null = null;
  let counting = false;
  const filters = new Map<string, unknown>();
  const chain = {
    update(next: { used_at: string | null }) { values = next; return chain; },
    select(_columns: string, options?: { count?: string; head?: boolean }) {
      counting = Boolean(options?.head);
      return chain;
    },
    eq(key: string, value: unknown) { filters.set(key, value); return chain; },
    is(key: string, value: unknown) { filters.set(key, value); return chain; },
    maybeSingle: async () => {
      if (values && codeUsedAt === null && filters.get("code_hash") === "hashed" && filters.get("used_at") === null) {
        codeUsedAt = values.used_at;
        return { data: { id: "code-1" }, error: null };
      }
      return { data: null, error: null };
    },
    then(resolve: (value: unknown) => unknown) {
      if (counting) return Promise.resolve(resolve({ count: codeUsedAt ? 0 : 1, error: null }));
      if (values?.used_at === null && filters.get("id") === "code-1" && filters.get("used_at") === codeUsedAt) {
        codeUsedAt = null;
      }
      return Promise.resolve(resolve({ error: null }));
    },
  };
  return chain;
}

beforeEach(() => {
  codeUsedAt = null;
  trustedDeleted = false;
  updateError = null;
  mocks.from.mockImplementation(from);
  mocks.hashCode.mockResolvedValue("hashed");
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0, remaining: 2 });
  mocks.recordAttempt.mockResolvedValue(undefined);
  mocks.listFactors.mockResolvedValue({ data: { factors: [{ id: "factor-1" }] }, error: null });
  mocks.deleteFactor.mockResolvedValue({ error: null });
  mocks.updateUserById.mockImplementation(async () => ({ error: updateError }));
  vi.clearAllMocks();
  mocks.from.mockImplementation(from);
  mocks.hashCode.mockResolvedValue("hashed");
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0, remaining: 2 });
  mocks.listFactors.mockResolvedValue({ data: { factors: [{ id: "factor-1" }] }, error: null });
  mocks.deleteFactor.mockResolvedValue({ error: null });
  mocks.updateUserById.mockImplementation(async () => ({ error: updateError }));
});

describe("account recovery with MFA", () => {
  it("consumes the code, resets the password and removes the old authenticator", async () => {
    await expect(recover(input)).resolves.toMatchObject({ ok: true, codesRemaining: 0, mfaRemoved: 1 });
    expect(codeUsedAt).not.toBeNull();
    expect(mocks.updateUserById).toHaveBeenCalledWith("user-1", expect.objectContaining({ password: input.data.newPassword }));
    expect(mocks.deleteFactor).toHaveBeenCalledWith({ userId: "user-1", id: "factor-1" });
    expect(trustedDeleted).toBe(true);
  });

  it("rejects reuse of an already consumed recovery code", async () => {
    await recover(input);
    await expect(recover(input)).rejects.toThrow("E-mail ou código");
    expect(mocks.updateUserById).toHaveBeenCalledTimes(1);
  });

  it("releases the code when the password update fails", async () => {
    updateError = { message: "unavailable" };
    await expect(recover(input)).rejects.toThrow("Nenhuma alteração foi feita");
    expect(codeUsedAt).toBeNull();
    expect(mocks.deleteFactor).not.toHaveBeenCalled();
  });

  it("does not disclose whether an email or code was invalid", async () => {
    mocks.hashCode.mockResolvedValue("wrong");
    await expect(recover(input)).rejects.toThrow("E-mail ou código de recuperação inválido.");
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("enforces recovery rate limiting in the server handler", async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfter: 120, remaining: 0 });
    await expect(recover(input)).rejects.toThrow("Muitas tentativas");
    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(mocks.recordAttempt).toHaveBeenCalledWith("recovery", "blocked", "masked");
  });
});
