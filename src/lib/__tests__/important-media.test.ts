import { describe, expect, it } from "vitest";
import { toImportantMediaItems } from "../important-media";

const msg = (id: string, thread: string, url: string | null) => ({ id, thread_id: thread, attachment_url: url, attachment_type: "image/png", created_at: "2026-10-28T00:00:00Z", is_admin: false });

describe("toImportantMediaItems", () => {
  it("keeps only attachments from the requested conversations", () => {
    const items = toImportantMediaItems([
      { message_id: "a", marked_at: "2026-10-28T01:00:00Z", support_messages: msg("a", "t1", "x/y/a.png") },
      { message_id: "b", marked_at: "2026-10-28T02:00:00Z", support_messages: msg("b", "t2", "x/y/b.png") },
      { message_id: "c", marked_at: "2026-10-28T03:00:00Z", support_messages: msg("c", "t1", null) },
    ], ["t1"]);
    expect(items.map((i) => i.messageId)).toEqual(["a"]);
  });
  it("lists the most recently marked first", () => {
    const items = toImportantMediaItems([
      { message_id: "a", marked_at: "2026-10-28T01:00:00Z", support_messages: msg("a", "t1", "p/a.png") },
      { message_id: "b", marked_at: "2026-10-28T05:00:00Z", support_messages: msg("b", "t1", "p/b.png") },
    ], ["t1"]);
    expect(items.map((i) => i.messageId)).toEqual(["b", "a"]);
  });
});

import { chunkIds, mergeBookmarkRows, toSignedImportantMediaItems } from "../important-media";

describe("toSignedImportantMediaItems (fail closed)", () => {
  const rows = [
    { message_id: "ok", marked_at: "2026-10-28T02:00:00Z", support_messages: msg("ok", "t1", "https://x/sign/support-media/u/t1/a.png?token=old") },
    { message_id: "badpath", marked_at: "2026-10-28T03:00:00Z", support_messages: msg("badpath", "t1", "https://x/sign/support-media/u/OTHER/b.png?token=old") },
    { message_id: "unsigned", marked_at: "2026-10-28T04:00:00Z", support_messages: msg("unsigned", "t1", "https://x/sign/support-media/u/t1/c.png?token=old") },
  ];
  const pathFor = (r: any) => (r.message_id === "badpath" ? null : `u/t1/${r.message_id}.png`);
  it("never returns the stored link for invalid keys or when signing produced nothing", () => {
    const items = toSignedImportantMediaItems(rows, ["t1"], pathFor, { "u/t1/ok.png": "https://signed/fresh" });
    expect(items.map((i) => i.messageId)).toEqual(["ok"]);
    expect(items[0]!.attachmentUrl).toBe("https://signed/fresh");
    expect(JSON.stringify(items)).not.toContain("token=old");
  });
  it("returns nothing when signing failed entirely", () => {
    expect(toSignedImportantMediaItems(rows, ["t1"], pathFor, {})).toEqual([]);
  });
});

describe("large customer histories", () => {
  it("splits 500 conversations into groups of at most 80", () => {
    const groups = chunkIds(Array.from({ length: 500 }, (_, i) => String(i)), 80);
    expect(groups).toHaveLength(7);
    expect(Math.max(...groups.map((g) => g.length))).toBe(80);
  });
  it("keeps the 200 newest marks across groups and flags the cut", () => {
    const g1 = Array.from({ length: 150 }, (_, i) => ({ message_id: `a${i}`, marked_at: `2026-10-01T00:${String(i % 60).padStart(2, "0")}:00Z` }));
    const g2 = Array.from({ length: 150 }, (_, i) => ({ message_id: `b${i}`, marked_at: `2026-10-02T00:${String(i % 60).padStart(2, "0")}:00Z` }));
    const r = mergeBookmarkRows([g1, g2], 200);
    expect(r.rows).toHaveLength(200);
    expect(r.truncated).toBe(true);
    expect(r.rows.filter((x) => x.message_id.startsWith("b"))).toHaveLength(150);
    expect(mergeBookmarkRows([g1], 200).truncated).toBe(false);
  });
});
