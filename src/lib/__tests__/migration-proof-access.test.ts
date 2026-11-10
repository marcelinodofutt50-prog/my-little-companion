import { describe, expect, it, vi } from "vitest";
import { authorizeMigrationProofs, migrationProofOwner } from "../migration-proof-access.server";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";

describe("private migration proofs", () => {
  it("allows the owner to preview their upload on either storage", async () => {
    const admin = vi.fn();
    await authorizeMigrationProofs({}, owner, [`${owner}/pix.png`, `s2/${owner}/pix.png`], admin);
    expect(admin).not.toHaveBeenCalled();
    expect(migrationProofOwner(`s2/${owner}/pix.png`)).toBe(owner);
  });
  it("rejects another customer's proof before privileged signing", async () => {
    const denied = vi.fn().mockRejectedValue(new Error("Forbidden"));
    const client = { from: vi.fn() };
    await expect(authorizeMigrationProofs(client, owner, [`${other}/pix.png`], denied)).rejects.toThrow();
    expect(client.from).not.toHaveBeenCalled();
  });
  it.each([`s2/s2/${owner}/pix.png`, `${owner}/../pix.png`, `${owner}/%2e%2e`, `${owner}/file?token=x`, `${owner}/file\\x`, `${owner}/.`, `https://example.com/${owner}/pix.png`])("rejects a noncanonical key %s", async (path) => {
    expect(migrationProofOwner(path)).toBeNull();
    const admin = vi.fn();
    await expect(authorizeMigrationProofs({}, owner, [path], admin)).rejects.toThrow();
    expect(admin).not.toHaveBeenCalled();
  });
  it("requires admin and an exact RLS-visible request attachment for a foreign proof", async () => {
    const admin = vi.fn().mockResolvedValue(undefined);
    const chain = { select: vi.fn(), eq: vi.fn(), contains: vi.fn(), limit: vi.fn() };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.contains.mockReturnValue(chain);
    chain.limit.mockResolvedValue({ data: [{ id: "request" }], error: null });
    await authorizeMigrationProofs({ from: () => chain }, owner, [`s2/${other}/pix.png`], admin);
    expect(admin).toHaveBeenCalledOnce();
    expect(chain.eq).toHaveBeenCalledWith("user_id", other);
    expect(chain.contains).toHaveBeenCalledWith("proof_paths", [`s2/${other}/pix.png`]);
    chain.limit.mockResolvedValue({ data: [], error: null });
    await expect(authorizeMigrationProofs({ from: () => chain }, owner, [`${other}/unattached.png`], admin)).rejects.toThrow();
    chain.limit.mockResolvedValue({ data: [{ id: "request" }], error: { message: "unavailable" } });
    await expect(authorizeMigrationProofs({ from: () => chain }, owner, [`${other}/pix.png`], admin)).rejects.toThrow();
  });
});