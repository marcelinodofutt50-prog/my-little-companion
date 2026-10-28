import { describe, expect, it } from "vitest";
import { creatorErrorMessage, deleteVideoOutcome } from "../creator-errors";

describe("Creator deletion results", () => {
  it("does not expose database internals through unknown errors", () => {
    const privateDetail = "private_table(customer_email=secret@example.invalid)";
    expect(creatorErrorMessage(privateDetail)).not.toContain(privateDetail);
  });
  it("does not report deletion success when authorization fails", () => {
    expect(deleteVideoOutcome({ message: "not_allowed" }, null).ok).toBe(false);
  });
  it("an error takes precedence over a success-shaped response", () => {
    expect(deleteVideoOutcome({ message: "network failure" }, true).ok).toBe(false);
  });
  it("reports a rejected deletion as unsuccessful", () => {
    expect(deleteVideoOutcome(null, false).ok).toBe(false);
    expect(deleteVideoOutcome(null, null).ok).toBe(false);
  });
  it("reports a confirmed deletion as successful", () => {
    expect(deleteVideoOutcome(null, true)).toEqual({ ok: true });
  });
});
