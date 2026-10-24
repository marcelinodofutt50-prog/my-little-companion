import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  remove: vi.fn(), create: vi.fn(), password: vi.fn(), update: vi.fn(), saved: vi.fn(),
}));
vi.mock("../yaarsa.server", () => ({
  refreshPanelOverrides: vi.fn(), panelForHost: () => "v46", decrypt: () => "fixture-password",
  yaarsaRemoveAccount: mocks.remove, yaarsaCreateAccount: mocks.create, yaarsaSetPassword: mocks.password,
  looksLikeRemoveConfirmed: (s: string) => /removed successfully/i.test(s ?? ""),
  looksLikeAccountCreated: (s: string) => /created successfully/i.test(s ?? ""),
}));
vi.mock("../password-safety.server", () => ({ sha256Hex: () => "fixture-fingerprint" }));
vi.mock("../panel-retry.server", () => ({ retryPanelCall: (fn: () => unknown) => fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: () => ({ update: mocks.update, insert: vi.fn().mockResolvedValue({ error: null }) }),
} }));
import { pauseLicenseCore, resumeLicenseCore } from "../license-pause.server";

const license = { id: "fixture", yaarsa_email: "fixture@example.test", yaarsa_username: "fixture",
  yaarsa_password_enc: "fixture", server_ip: "fixture-host", panel: "v457", expires_at: null,
  server_paid_until: "2026-11-20T03:00:00Z", plan_slug: "lifetime" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.remove.mockResolvedValue({ Success: "Client removed successfully!" });
  mocks.create.mockResolvedValue({ Success: "Account created successfully!" });
  mocks.password.mockResolvedValue({ Success: "Password updated successfully!" });
  mocks.saved.mockResolvedValue({ data: { id: "fixture" }, error: null });
  const chain = { eq: () => chain, is: () => chain, select: () => chain, maybeSingle: mocks.saved };
  mocks.update.mockReturnValue(chain);
});

describe("panel pause lifecycle", () => {
  it("revokes on the displayed host without sending past expiration dates", async () => {
    await pauseLicenseCore(license, { by: "user", actorId: "fixture", pauseUntil: new Date("2026-11-01") });
    expect(mocks.remove).toHaveBeenCalledWith("fixture@example.test", "v46");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.password).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ expires_at_before_suspend: null, server_paid_until_before_suspend: license.server_paid_until }));
  });
  it("does not record a pause when the panel refuses removal", async () => {
    mocks.remove.mockResolvedValue({ Fail: "panel unavailable" });
    await expect(pauseLicenseCore(license, { by: "user", actorId: "fixture", pauseUntil: new Date("2026-11-01") })).rejects.toThrow("revogação");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("recreates the same login and reapplies the original password on return", async () => {
    await resumeLicenseCore({ ...license, suspended_at: new Date(Date.now() - 86400000).toISOString() }, { by: "user", actorId: "fixture" });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ email: license.yaarsa_email, username: license.yaarsa_username, password: "fixture-password", panel: "v46" }));
    expect(mocks.password).toHaveBeenCalledWith(license.yaarsa_email, "fixture-password", "v46", license.yaarsa_username, expect.any(String));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ suspended_at: null }));
  });
  it("keeps days frozen and revokes again if the original password cannot be applied", async () => {
    mocks.password.mockResolvedValue({ Fail: "password rejected" });
    await expect(resumeLicenseCore({ ...license, suspended_at: new Date().toISOString() }, { by: "auto", actorId: null })).rejects.toThrow("senha original");
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});