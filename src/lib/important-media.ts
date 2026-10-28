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
