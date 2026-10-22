import { describe, expect, it } from "vitest";
import { adminLicenseStatus, isAdminLicenseArchived, matchesAdminLicenseSearch } from "@/lib/admin-license-list";

const now = Date.parse("2026-10-22T02:09:00Z");

describe("admin license presentation", () => {
  it("keeps paused licenses visible even when their frozen expiry is in the past", () => {
    const license = { suspended_at: "2026-10-16T12:00:00Z", expires_at: "2026-10-17T12:00:00Z" };
    expect(adminLicenseStatus(license, now)).toBe("paused");
    expect(isAdminLicenseArchived(license, now)).toBe(false);
  });
  it("never presents disabled or revoked access as active", () => {
    expect(adminLicenseStatus({ disabled_at: "2026-10-20", expires_at: "2099-01-01" }, now)).toBe("disabled");
    expect(adminLicenseStatus({ revoked: true, suspended_at: "2026-10-20" }, now)).toBe("revoked");
  });
  it("handles expiration boundary and invalid dates without an active label", () => {
    expect(adminLicenseStatus({ expires_at: new Date(now).toISOString() }, now)).toBe("expired");
    expect(adminLicenseStatus({ expires_at: "invalid" }, now)).toBe("disabled");
  });
  it("finds licenses by host, ID and customer name without searching passwords", () => {
    const license = { id: "license-123", server_ip: "192.0.2.10", profile: { full_name: "Cliente Shadow" }, yaarsa_password: "private-secret" };
    expect(matchesAdminLicenseSearch(license, "192.0.2.10")).toBe(true);
    expect(matchesAdminLicenseSearch(license, "license-123")).toBe(true);
    expect(matchesAdminLicenseSearch(license, "  CLIENTE  ")).toBe(true);
    expect(matchesAdminLicenseSearch(license, "private-secret")).toBe(false);
  });
});