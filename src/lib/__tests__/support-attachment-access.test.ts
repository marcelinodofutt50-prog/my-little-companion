import { describe, expect, it } from "vitest";
import { canAttachSupportMedia } from "../support-attachment-access";

const thread = "11111111-1111-4111-8111-111111111111";
const otherThread = "22222222-2222-4222-8222-222222222222";
const user = "33333333-3333-4333-8333-333333333333";

describe("support attachment isolation", () => {
  it("allows a customer's own attachment in this conversation", () => {
    expect(canAttachSupportMedia(`${user}/${thread}/print.png`, thread, user, false)).toBe(true);
  });
  it("allows secondary storage without changing ownership", () => {
    expect(canAttachSupportMedia(`s2/${user}/${thread}/print.png`, thread, user, false)).toBe(true);
  });
  it("allows verified staff attachments for this conversation", () => {
    expect(canAttachSupportMedia(`s2/staff/${thread}/print.png`, thread, user, true)).toBe(true);
  });
  it("rejects staff files for customers", () => {
    expect(canAttachSupportMedia(`staff/${thread}/print.png`, thread, user, false)).toBe(false);
  });
  it("rejects files from another conversation even for staff", () => {
    expect(canAttachSupportMedia(`staff/${otherThread}/print.png`, thread, user, true)).toBe(false);
  });
  it("rejects another customer's namespace", () => {
    expect(canAttachSupportMedia(`other-user/${thread}/print.png`, thread, user, false)).toBe(false);
  });
  it.each([
    `staff/${thread}/../print.png`,
    `staff/${thread}/..`,
    `staff/${thread}/%2e%2e`,
    `staff/${thread}/print%2fpng`,
    `staff/${thread}\\print.png`,
    `/staff/${thread}/print.png`,
    `s2/s2/staff/${thread}/print.png`,
    `https://example.com/staff/${thread}/print.png`,
    `staff/${thread}/print.png?token=secret`,
    `staff/${thread}/print.png#fragment`,
    `staff/${thread}/print\u0000.png`,
    `staff/${thread}/`,
  ])("rejects noncanonical storage key %s", (path) => {
    expect(canAttachSupportMedia(path, thread, user, true)).toBe(false);
  });
});
