import { describe, expect, it } from "vitest";
import {
  clearTrustedDeviceTokens,
  mfaVerificationMessage,
  normalizeMfaCode,
  readTrustedDeviceToken,
  trustedDeviceKey,
  writeTrustedDeviceToken,
} from "../mfa-client";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key(index: number) { return [...values.keys()][index] ?? null; },
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
    removeItem(key: string) { values.delete(key); },
  } as Storage;
}

describe("MFA local helpers", () => {
  it("accepts only six numeric digits", () => {
    expect(normalizeMfaCode(" 12a34-56789 ")).toBe("123456");
  });

  it("keeps trusted-device data isolated by account", () => {
    const storage = memoryStorage();
    expect(writeTrustedDeviceToken("user-a", "token-a", storage)).toBe(true);
    expect(readTrustedDeviceToken("user-a", storage)).toBe("token-a");
    expect(readTrustedDeviceToken("user-b", storage)).toBeNull();
    expect(trustedDeviceKey("user-a")).not.toBe(trustedDeviceKey("user-b"));
  });

  it("does not break MFA when browser storage is blocked", () => {
    const blocked = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("blocked"); },
      removeItem() { throw new Error("blocked"); },
    };
    expect(readTrustedDeviceToken("user-a", blocked)).toBeNull();
    expect(writeTrustedDeviceToken("user-a", "token", blocked)).toBe(false);
    expect(() => clearTrustedDeviceTokens(null)).not.toThrow();
  });

  it("removes only trusted-device keys", () => {
    const storage = memoryStorage();
    storage.setItem(trustedDeviceKey("user-a"), "token");
    storage.setItem("unrelated", "keep");
    clearTrustedDeviceTokens(storage);
    expect(storage.getItem(trustedDeviceKey("user-a"))).toBeNull();
    expect(storage.getItem("unrelated")).toBe("keep");
  });

  it("does not describe a network failure as an incorrect code", () => {
    expect(mfaVerificationMessage({ message: "Failed to fetch" })).toMatch(/internet/i);
    expect(mfaVerificationMessage({ message: "Invalid TOTP code" })).toMatch(/incorreto/i);
    expect(mfaVerificationMessage({ status: 429 })).toMatch(/Muitas tentativas/);
  });
});
