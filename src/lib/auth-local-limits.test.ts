import { afterEach, describe, expect, it, vi } from "vitest";
import { attemptsInfo, bumpAttempts, clearStoredLimits, readCooldown, writeCooldown } from "./auth-local-limits";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("optional auth local hints", () => {
  it("does not interrupt access when browser storage is blocked", () => {
    const blocked = () => { throw new Error("blocked"); };
    vi.stubGlobal("window", { localStorage: { getItem: blocked, setItem: blocked, removeItem: blocked } });
    expect(readCooldown("qa@example.invalid")).toBe(0);
    expect(attemptsInfo("qa@example.invalid")).toEqual({ count: 0, last: null });
    expect(bumpAttempts("qa@example.invalid")).toBe(1);
    expect(() => writeCooldown("qa@example.invalid", 60)).not.toThrow();
    expect(() => clearStoredLimits("qa@example.invalid")).not.toThrow();
  });
  it("repairs non-array history instead of crashing on resend", () => {
    const data = new Map<string, string>([["shadow.auth.emailAttempts:qa@example.invalid", "{}"]]);
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => data.get(k), setItem: (k: string, v: string) => data.set(k, v) } });
    expect(bumpAttempts("qa@example.invalid")).toBe(1);
    expect(attemptsInfo("qa@example.invalid").count).toBe(1);
  });
  it("ignores invalid and future timestamps and invalid cooldowns", () => {
    const now = Date.now();
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => k.includes("Attempts") ? JSON.stringify([now - 1000, now + 10000, "bad", null, now - 3600000]) : "NaN" } });
    expect(attemptsInfo("qa@example.invalid")).toEqual({ count: 1, last: now - 1000 });
    expect(readCooldown("qa@example.invalid")).toBe(0);
  });
});