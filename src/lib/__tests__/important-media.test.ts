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
