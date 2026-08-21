import { describe, expect, it, vi } from "vitest";
import {
  checkRedeemCode,
  describeRedeemCode,
  extendedExpiry,
  generateRedeemCode,
  normalizeRedeemCode,
} from "@/lib/redeem-rules";

describe("regras dos códigos de cortesia", () => {
  it("normaliza códigos e gera formato legível sem caracteres ambíguos", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.2);
    expect(normalizeRedeemCode(" shdw-abcd  -2345 ")).toBe("SHDW-ABCD-2345");
    expect(generateRedeemCode()).toMatch(/^SHDW-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    vi.restoreAllMocks();
  });

  it("rejeita código ausente, inativo, vencido ou esgotado", () => {
    const now = Date.parse("2026-08-21T12:00:00Z");
    expect(checkRedeemCode(null, now)).toMatchObject({ ok: false, reason: "not_found" });
    expect(checkRedeemCode({ code: "A", kind: "license_days", active: false }, now)).toMatchObject({ reason: "inactive" });
    expect(checkRedeemCode({ code: "A", kind: "license_days", expires_at: "2026-08-20T00:00:00Z" }, now)).toMatchObject({ reason: "expired" });
    expect(checkRedeemCode({ code: "A", kind: "license_days", uses: 1, max_uses: 1 }, now)).toMatchObject({ reason: "used_up" });
  });

  it("soma dias sobre a validade restante e descreve ambos os benefícios", () => {
    const now = Date.parse("2026-08-21T00:00:00Z");
    expect(extendedExpiry("2026-08-25T00:00:00Z", 3, now).toISOString()).toBe("2026-08-28T00:00:00.000Z");
    expect(extendedExpiry("2026-08-01T00:00:00Z", 7, now).toISOString()).toBe("2026-08-28T00:00:00.000Z");
    expect(describeRedeemCode({ code: "A", kind: "license_days", days: 7 })).toContain("7 dias");
    expect(describeRedeemCode({ code: "B", kind: "server_renewal" })).toContain("dia 20");
  });
});