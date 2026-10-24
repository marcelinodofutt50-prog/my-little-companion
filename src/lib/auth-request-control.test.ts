import { describe, expect, it } from "vitest";
import { createAuthTransitionFilter, isChunkLoadError, singleFlight } from "./auth-request-control";

describe("auth request amplification", () => {
  it("shares concurrent validation but validates again after completion", async () => {
    let calls = 0;
    const load = singleFlight(async () => ++calls);
    expect(await Promise.all([load(), load(), load()])).toEqual([1, 1, 1]);
    expect(calls).toBe(1);
    expect(await load()).toBe(2);
  });
  it("does not retain failed validations", async () => {
    let calls = 0;
    const load = singleFlight(async () => { if (++calls === 1) throw new Error("offline"); return calls; });
    await expect(load()).rejects.toThrow("offline");
    expect(await load()).toBe(2);
  });
  it("does not refetch on same-account focus or token refresh", () => {
    const transition = createAuthTransitionFilter();
    expect(transition("INITIAL_SESSION", "account-a")).toBe(false);
    expect(transition("SIGNED_IN", "account-a")).toBe(false);
    expect(transition("TOKEN_REFRESHED", "account-a")).toBe(false);
    expect(transition("SIGNED_IN", "account-b")).toBe(true);
    expect(transition("SIGNED_OUT", null)).toBe(true);
    expect(transition("SIGNED_OUT", null)).toBe(false);
    expect(transition("MFA_CHALLENGE_VERIFIED", "account-b")).toBe(true);
    expect(transition("USER_UPDATED", "account-b")).toBe(true);
  });
  it("does not reload the page on auth/network failures", () => {
    expect(isChunkLoadError("Failed to fetch")).toBe(false);
    expect(isChunkLoadError("AuthRetryableFetchError: Failed to fetch")).toBe(false);
    expect(isChunkLoadError("Failed to fetch dynamically imported module: /assets/page.js")).toBe(true);
  });
});