/** Pure shaping for admin "important media" bookmarks (private, never payment approval). */
export type ImportantMediaRow = {
  message_id: string;
  marked_at: string;
  support_messages?: {
    id: string;
    thread_id: string;
    attachment_url: string | null;
    attachment_type: string | null;
    created_at: string;
    is_admin: boolean | null;
    sender_id?: string | null;
  } | null;
};

export type ImportantMediaItem = {
  messageId: string;
  threadId: string;
  attachmentUrl: string;
  attachmentType: string | null;
  sentAt: string;
  markedAt: string;
  fromStaff: boolean;
};

/** Drops rows without an attachment or outside the requested threads; newest mark first. */
export function toImportantMediaItems(rows: ImportantMediaRow[], threadIds: string[]): ImportantMediaItem[] {
  const allowed = new Set(threadIds);
  const items: ImportantMediaItem[] = [];
  for (const row of rows) {
    const m = row.support_messages;
    if (!m || !m.attachment_url || !allowed.has(m.thread_id)) continue;
    items.push({
      messageId: row.message_id,
      threadId: m.thread_id,
      attachmentUrl: m.attachment_url,
      attachmentType: m.attachment_type,
      sentAt: m.created_at,
      markedAt: row.marked_at,
      fromStaff: Boolean(m.is_admin),
    });
  }
  return items.sort((a, b) => b.markedAt.localeCompare(a.markedAt) || b.messageId.localeCompare(a.messageId));
}

/** Splits a list into fixed-size groups so large `IN (...)` filters never overflow the request URL. */
export function chunkIds<T>(ids: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/** Merges per-group bookmark pages, newest mark first, and reports whether rows were cut off. */
export function mergeBookmarkRows<R extends { message_id: string; marked_at: string }>(groups: R[][], limit: number): { rows: R[]; truncated: boolean } {
  const all = groups.flat().sort((a, b) => b.marked_at.localeCompare(a.marked_at) || b.message_id.localeCompare(a.message_id));
  return { rows: all.slice(0, limit), truncated: all.length > limit };
}

/**
 * Fail-closed shaping: a bookmark is returned only when its storage key passed validation
 * AND a fresh signed link exists. The stored attachment URL is never echoed back.
 */
export function toSignedImportantMediaItems(
  rows: ImportantMediaRow[],
  threadIds: string[],
  pathFor: (row: ImportantMediaRow) => string | null,
  signed: Record<string, string>,
): ImportantMediaItem[] {
  const allowed = new Set(threadIds);
  const items: ImportantMediaItem[] = [];
  for (const item of toImportantMediaItems(rows.filter((r) => r.support_messages && allowed.has(r.support_messages.thread_id)), threadIds)) {
    const row = rows.find((r) => r.message_id === item.messageId);
    const path = row ? pathFor(row) : null;
    const url = path ? signed[path] : undefined;
    if (url) items.push({ ...item, attachmentUrl: url });
  }
  return items;
}
