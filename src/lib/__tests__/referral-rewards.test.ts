import { describe, expect, it } from "vitest";
import {
  BUYER_REFERRAL_BONUS_DAYS,
  REFERRER_PURCHASE_REWARD_DAYS,
  calculateRewardExpiry,
  isReferralRewardEligible,
} from "../referral-rewards";

describe("purchase referral rewards", () => {
  it("uses the configured 3-day referrer and 1-day buyer rewards", () => {
    expect(REFERRER_PURCHASE_REWARD_DAYS).toBe(3);
    expect(BUYER_REFERRAL_BONUS_DAYS).toBe(1);
  });

  it("extends from a future expiry without shortening existing access", () => {
    const now = new Date("2026-10-09T12:00:00.000Z");
    expect(calculateRewardExpiry("2026-10-20T12:00:00.000Z", 3, now))
      .toBe("2026-10-23T12:00:00.000Z");
  });

  it("starts from now when the previous expiry has already passed", () => {
    const now = new Date("2026-10-09T12:00:00.000Z");
    expect(calculateRewardExpiry("2026-10-01T12:00:00.000Z", 3, now))
      .toBe("2026-10-12T12:00:00.000Z");
  });

  it("rejects invalid reward durations", () => {
    expect(() => calculateRewardExpiry(null, 0, new Date())).toThrow();
    expect(() => calculateRewardExpiry(null, 31, new Date())).toThrow();
  });

  it("does not retroactively reward old orders without the new marker", () => {
    expect(isReferralRewardEligible({
      status: "paid", user_id: "buyer", referrer_id: "referrer", plan_slug: "login-30d",
    })).toBe(false);
  });

  it("only rewards paid orders with a distinct referrer and non-server plan", () => {
    expect(isReferralRewardEligible({
      status: "paid", user_id: "buyer", referrer_id: "referrer", plan_slug: "login-30d", metadata: { referral_rewards_version: 1 },
    })).toBe(true);
    expect(isReferralRewardEligible({
      status: "pending", user_id: "buyer", referrer_id: "referrer", plan_slug: "login-30d", metadata: { referral_rewards_version: 1 },
    })).toBe(false);
    expect(isReferralRewardEligible({
      status: "paid", user_id: "same", referrer_id: "same", plan_slug: "login-30d", metadata: { referral_rewards_version: 1 },
    })).toBe(false);
    expect(isReferralRewardEligible({
      status: "paid", user_id: "buyer", referrer_id: "referrer", plan_slug: "server-monthly", metadata: { referral_rewards_version: 1 },
    })).toBe(false);
    expect(isReferralRewardEligible({
      status: "paid", user_id: "buyer", referrer_id: "referrer", plan_slug: "login-30d", metadata: { referral_rewards_version: 1, gift: {} },
    })).toBe(false);
  });
});
