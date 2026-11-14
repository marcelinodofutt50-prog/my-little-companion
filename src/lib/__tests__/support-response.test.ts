import { describe, expect, it } from "vitest";
import { isAwaitingSupportResponse, supportResponseAge } from "../support-response";

const now = Date.parse("2026-11-13T12:00:00Z");
const at = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();

describe("support response state", () => {
  it("waits when the customer wrote after the staff", () => {
    expect(isAwaitingSupportResponse({ status: "open", last_customer_message_at: at(2), last_staff_message_at: at(3) })).toBe(true);
  });

  it("does not wait when the staff replied last or timestamps are equal", () => {
    expect(isAwaitingSupportResponse({ status: "open", last_customer_message_at: at(3), last_staff_message_at: at(2) })).toBe(false);
    expect(isAwaitingSupportResponse({ status: "open", last_customer_message_at: at(2), last_staff_message_at: at(2) })).toBe(false);
  });

  it("does not wait without a valid customer message or after closure", () => {
    expect(isAwaitingSupportResponse({ status: "open", last_staff_message_at: at(2) })).toBe(false);
    expect(isAwaitingSupportResponse({ status: "closed", last_customer_message_at: at(1) })).toBe(false);
    expect(isAwaitingSupportResponse({ status: "open", last_customer_message_at: "invalid" })).toBe(false);
  });

  it("shows the age of the customer message awaiting response", () => {
    const thread = { status: "open", last_customer_message_at: at(5), last_staff_message_at: null };
    expect(supportResponseAge(thread, now)).toBe("há 5 h");
  });
});
