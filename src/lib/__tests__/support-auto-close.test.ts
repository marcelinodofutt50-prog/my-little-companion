import { describe, expect, it } from "vitest";
import { runSupportAutoClose } from "../support-auto-close.server";

const now = Date.parse("2026-11-01T12:00:00Z");
const old = new Date(now - 6 * 3600_000).toISOString();
function database(options: { pending?: boolean; readError?: boolean; changed?: boolean; recent?: boolean; recentMessage?: boolean; empty?: boolean; pages?: number } = {}) {
  let scanned = 0;
  const writes: string[] = [];
  const db = { from(table: string) {
    let update = false, insert = false;
    const chain: any = {
      select: () => chain, neq: () => chain, lte: () => chain, order: () => chain, limit: () => chain,
      eq: () => chain,
      or: () => chain, in: () => chain, range: () => { scanned++; return chain; },
      update: () => { update = true; return chain; },
      insert: () => { insert = true; writes.push("notice"); return chain; },
      maybeSingle: async () => { if (!options.changed) writes.push("closed"); return { data: options.changed ? null : { id: "t" }, error: null }; },
      then: (resolve: (v: unknown) => unknown) => {
        let data: any[] = [];
        if (table === "support_threads" && !update) {
          const row = { id: "t", user_id: "u", updated_at: old, created_at: old, last_staff_message_at: options.recent ? new Date(now).toISOString() : old };
          data = options.pages && scanned === 1 ? Array.from({ length: 500 }, (_, i) => ({ ...row, id: `${i}` })) : scanned > 1 ? [] : [row];
        } else if (table === "support_messages" && !insert) {
          data = options.empty ? [] : [{ created_at: options.recentMessage ? new Date(now).toISOString() : old }];
        } else if (table === "orders" && options.pending) data = [{ id: "order" }];
        return Promise.resolve(resolve({ data, error: options.readError && table === "orders" ? { message: "offline" } : null }));
      },
    };
    return chain;
  }};
  return { db, writes, scans: () => scanned };
}
describe("safe ticket closure execution", () => {
  it("closes idle tickets without reading the message body", async () => {
    const f = database();
    expect((await runSupportAutoClose(f.db, now)).closed).toBe(1);
    expect(f.writes).toEqual(["closed", "notice"]);
  });
  it("never closes a customer with a pending payment", async () => {
    const f = database({ pending: true });
    expect((await runSupportAutoClose(f.db, now)).pendingPayment).toBe(1);
    expect(f.writes).toEqual([]);
  });
  it("fails closed when payment evidence cannot be read", async () => {
    const f = database({ readError: true });
    expect((await runSupportAutoClose(f.db, now)).readFailures).toBe(1);
    expect(f.writes).toEqual([]);
  });
  it("closes old empty tickets", async () => {
    const f = database({ empty: true });
    expect((await runSupportAutoClose(f.db, now)).closed).toBe(1);
  });
  it("uses the latest message timestamp when thread timestamps lag", async () => {
    const f = database({ recentMessage: true });
    expect((await runSupportAutoClose(f.db, now)).recentActivity).toBe(1);
    expect(f.writes).toEqual([]);
  });
  it("does not close a thread changed since the read", async () => {
    const f = database({ changed: true });
    expect((await runSupportAutoClose(f.db, now)).changed).toBe(1);
    expect(f.writes).toEqual([]);
  });
  it("waits five hours after all thread activity", async () => {
    const f = database({ recent: true });
    expect((await runSupportAutoClose(f.db, now)).recentActivity).toBe(1);
    expect(f.writes).toEqual([]);
  });
  it("collects the next page before closing rows", async () => {
    const f = database({ pages: 2 });
    expect((await runSupportAutoClose(f.db, now)).checked).toBe(500);
    expect(f.scans()).toBe(2);
  });
});