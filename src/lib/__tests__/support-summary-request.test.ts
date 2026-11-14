import { describe, expect, it } from "vitest";
import { createThreadSummaryRequestGuard } from "../support-summary-request";

describe("thread summary request isolation", () => {
  it("rejects a summary from ticket A after switching to ticket B", () => {
    const guard = createThreadSummaryRequestGuard("a");
    const requestA = guard.begin("a");
    guard.enter("b");
    expect(guard.isCurrent(requestA)).toBe(false);
  });

  it("rejects old completions after switching A to B and back to A", () => {
    const guard = createThreadSummaryRequestGuard("a");
    const oldA = guard.begin("a");
    guard.enter("b");
    guard.begin("b");
    guard.enter("a");
    expect(guard.isCurrent(oldA)).toBe(false);
  });

  it("accepts only the newest operation in the current ticket", () => {
    const guard = createThreadSummaryRequestGuard("a");
    const first = guard.begin("a");
    const second = guard.begin("a");
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  it("rejects completions after the chat unmounts", () => {
    const guard = createThreadSummaryRequestGuard("a");
    const request = guard.begin("a");
    guard.cancel();
    expect(guard.isCurrent(request)).toBe(false);
  });
});
