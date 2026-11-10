import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ roles: [] as { role: string }[] }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({ select: () => ({ eq: async () => ({ data: state.roles, error: null }) }) }) } }));
import { assertStaffRole } from "../roles.server";
beforeEach(() => { state.roles = []; });

describe("private support staff access", () => {
  it.each(["admin", "moderator", "support"])("requires satisfied MFA for %s before privileged support access", async (role) => {
    let allowed = false;
    const context = { userId: "staff", supabase: { rpc: vi.fn(async (name, args) => name === "has_role" ? { data: args._role === role, error: null } : { data: allowed, error: null }) } };
    await expect(assertStaffRole(context)).rejects.toThrow();
    allowed = true;
    await expect(assertStaffRole(context)).resolves.toBeUndefined();
    expect(context.supabase.rpc).toHaveBeenCalledWith("mfa_satisfied");
  });
  it("fails closed when MFA verification is unavailable", async () => {
    const context = { userId: "staff", supabase: { rpc: async (name: string) => name === "has_role" ? { data: true } : { data: true, error: { message: "unavailable" } } } };
    await expect(assertStaffRole(context)).rejects.toThrow();
  });
  it("does not grant support access to customers with satisfied MFA", async () => {
    const context = { userId: "customer", supabase: { rpc: async (name: string) => ({ data: name === "mfa_satisfied", error: null }) } };
    await expect(assertStaffRole(context)).rejects.toThrow("Forbidden");
  });
});