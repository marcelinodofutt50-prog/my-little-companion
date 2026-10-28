import { describe, expect, it } from "vitest";
import { creatorErrorMessage, deleteVideoOutcome } from "../creator-errors";

describe("creator error messages", () => {
  it("maps the daily video limit to a friendly message", () => {
    expect(creatorErrorMessage("rate_limited")).toContain("Limite de 5 vídeos por dia");
  });
  it("does not echo raw database text", () => {
    const msg = creatorErrorMessage("relation creator_videos violates something", "23505");
    expect(msg).not.toContain("creator_videos");
    expect(msg).toContain("23505");
  });
  it("reports a missing 2FA instead of blaming video status when deletion errors", () => {
    const out = deleteVideoOutcome({ message: "not_allowed" }, null);
    expect(out.ok).toBe(false);
    expect(out.message).toContain("2FA");
  });
  it("only blames video status when the RPC succeeded with false", () => {
    expect(deleteVideoOutcome(null, false).message).toContain("em análise");
    expect(deleteVideoOutcome(null, true).ok).toBe(true);
  });
});
