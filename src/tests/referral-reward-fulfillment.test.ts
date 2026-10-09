import { beforeEach, describe, expect, it, vi } from "vitest";

const yaarsaExtend = vi.fn();
vi.mock("@/lib/yaarsa.server", () => ({ yaarsaExtend }));

describe("grantReferralPurchaseReward", () => {
  beforeEach(() => {
    yaarsaExtend.mockReset();
    yaarsaExtend.mockResolvedValue({});
  });

  it("applies the stored absolute expiry and marks the target synced", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: {
          ok: true,
          grant_id: "grant-1",
          status: "pending",
          targets: [{
            id: "target-1",
            target_expires_at: "2026-10-20T12:00:00.000Z",
            panel: "v46",
            yaarsa_email: "customer@example.test",
            synced: false,
          }],
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null });
    const admin = { rpc } as any;

    const { grantReferralPurchaseReward } = await import("@/lib/referral-rewards.server");
    const result = await grantReferralPurchaseReward(admin, "order-1");

    expect(result).toEqual({ ok: true, reason: "referral-reward-processed" });
    expect(yaarsaExtend).toHaveBeenCalledWith("customer@example.test", "2026-10-20", "v46");
    expect(rpc).toHaveBeenNthCalledWith(1, "prepare_referral_purchase_reward", { p_order_id: "order-1" });
    expect(rpc).toHaveBeenNthCalledWith(2, "mark_referral_reward_license_synced", { p_target_id: "target-1" });
  });

  it("does not re-apply a target already synchronized by a previous webhook attempt", async () => {
    const admin = {
      rpc: vi.fn().mockResolvedValueOnce({
        data: {
          ok: true,
          status: "granted",
          targets: [{
            id: "target-1",
            target_expires_at: "2026-10-20T12:00:00.000Z",
            panel: "v46",
            yaarsa_email: "customer@example.test",
            synced: true,
          }],
        },
        error: null,
      }),
    } as any;

    const { grantReferralPurchaseReward } = await import("@/lib/referral-rewards.server");
    const result = await grantReferralPurchaseReward(admin, "order-1");

    expect(result).toEqual({ ok: true, reason: "referral-reward-processed" });
    expect(yaarsaExtend).not.toHaveBeenCalled();
  });

  it("does not report delivery when the external panel fails", async () => {
    yaarsaExtend.mockResolvedValueOnce({ Fail: "panel unavailable" });
    const admin = {
      rpc: vi.fn().mockResolvedValueOnce({
        data: {
          ok: true,
          status: "pending",
          targets: [{
            id: "target-1",
            target_expires_at: "2026-10-20T12:00:00.000Z",
            panel: "v46",
            yaarsa_email: "customer@example.test",
            synced: false,
          }],
        },
        error: null,
      }),
    } as any;

    const { grantReferralPurchaseReward } = await import("@/lib/referral-rewards.server");
    await expect(grantReferralPurchaseReward(admin, "order-1")).rejects.toThrow(
      "O painel recusou a extensão da licença indicada.",
    );
  });
});
