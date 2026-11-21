import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserById = vi.fn();
const getActiveBan = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { auth: { admin: { getUserById } } },
}));
vi.mock("@/lib/ban-engine.server", () => ({ getActiveBan }));

import { getLifetimeOfferEligibility } from "@/lib/lifetime-promotion.server";

const NOW = new Date("2026-11-21T16:00:00.000Z").getTime();

describe("elegibilidade da oferta Vitalício no servidor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveBan.mockResolvedValue(null);
  });

  it("permite uma conta criada há menos de 6 horas", async () => {
    getUserById.mockResolvedValue({ data: { user: { created_at: "2026-11-21T10:00:01.000Z" } }, error: null });
    await expect(getLifetimeOfferEligibility("member", NOW)).resolves.toEqual({ active: true, remainingMs: 1000 });
  });

  it("bloqueia uma conta ao completar 6 horas", async () => {
    getUserById.mockResolvedValue({ data: { user: { created_at: "2026-11-21T10:00:00.000Z" } }, error: null });
    await expect(getLifetimeOfferEligibility("member", NOW)).resolves.toEqual({ active: false, remainingMs: 0 });
  });

  it("bloqueia conta banida mesmo dentro das primeiras 6 horas", async () => {
    getUserById.mockResolvedValue({ data: { user: { created_at: "2026-11-21T15:00:00.000Z" } }, error: null });
    getActiveBan.mockResolvedValue({ id: "ban" });
    await expect(getLifetimeOfferEligibility("member", NOW)).resolves.toEqual({ active: false, remainingMs: 0 });
  });

  it("fecha a oferta se a data real da conta não puder ser confirmada", async () => {
    getUserById.mockResolvedValue({ data: { user: null }, error: new Error("unavailable") });
    await expect(getLifetimeOfferEligibility("member", NOW)).resolves.toEqual({ active: false, remainingMs: 0 });
    expect(getActiveBan).not.toHaveBeenCalled();
  });
});
