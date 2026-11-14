export type SupportResponseThread = {
  status?: string | null;
  last_customer_message_at?: string | null;
  last_staff_message_at?: string | null;
};

function timestamp(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** True when the latest customer message is newer than the latest staff reply. */
export function isAwaitingSupportResponse(thread: SupportResponseThread): boolean {
  if (thread.status === "closed") return false;
  const customerAt = timestamp(thread.last_customer_message_at);
  if (customerAt === null) return false;
  const staffAt = timestamp(thread.last_staff_message_at);
  return staffAt === null || customerAt > staffAt;
}

/** Compact age for the latest customer message, only while awaiting a reply. */
export function supportResponseAge(thread: SupportResponseThread, now = Date.now()): string | null {
  if (!isAwaitingSupportResponse(thread)) return null;
  const customerAt = timestamp(thread.last_customer_message_at);
  if (customerAt === null) return null;
  const minutes = Math.max(0, Math.floor((now - customerAt) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}
