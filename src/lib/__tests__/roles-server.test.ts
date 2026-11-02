import { beforeEach, describe, expect, it, vi } from "vitest";

const { adminFrom } = vi.hoisted(() => ({
  adminFrom: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: adminFrom },
}));

import { assertAdminRole, assertStaffRole, resolveRoles } from "../roles.server";

describe("server role checks", () => {
  beforeEach(() => {
    adminFrom.mockReset();
  });

  it("does not query the service-role fallback when all role RPCs validly return false", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    };

    await expect(resolveRoles({ supabase, userId: "user-1" })).resolves.toEqual({
      isAdmin: false,
      isModerator: false,
      isSupport: false,
      isStaff: false,
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(3);
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("uses the single is_staff RPC for a normal staff authorization check", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    };

    await expect(assertStaffRole({ supabase, userId: "user-1" })).resolves.toBeUndefined();

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("is_staff", { _user_id: "user-1" });
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("does not use the service-role fallback to bypass MFA after an RPC failure", async () => {
    const supabase = {
      rpc: vi.fn(async (name: string) => {
        if (name === "mfa_satisfied") return { data: false, error: null };
        return { data: false, error: { message: "RPC unavailable" } };
      }),
    };

    await expect(resolveRoles({ supabase, userId: "user-1" })).resolves.toEqual({
      isAdmin: false,
      isModerator: false,
      isSupport: false,
      isStaff: false,
    });

    expect(supabase.rpc).toHaveBeenCalledWith("mfa_satisfied");
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("uses the service-role fallback only after an RPC failure and successful MFA", async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ role: "admin" }],
      error: null,
    });
    const select = vi.fn(() => ({ eq }));
    adminFrom.mockReturnValue({ select });

    const supabase = {
      rpc: vi.fn(async (name: string, args?: { _role?: string }) => {
        if (name === "mfa_satisfied") return { data: true, error: null };
        if (args?._role === "admin") return { data: false, error: { message: "RPC unavailable" } };
        return { data: false, error: null };
      }),
    };

    await expect(resolveRoles({ supabase, userId: "user-1" })).resolves.toEqual({
      isAdmin: true,
      isModerator: false,
      isSupport: false,
      isStaff: true,
    });

    expect(adminFrom).toHaveBeenCalledWith("user_roles");
    expect(select).toHaveBeenCalledWith("role");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("checks admin permission with one role RPC on the successful path", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    };

    await expect(assertAdminRole({ supabase, userId: "user-1" })).resolves.toBeUndefined();

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("has_role", {
      _user_id: "user-1",
      _role: "admin",
    });
  });
});
