export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export function receiptMime(bytes: Uint8Array): string | null {
  if (!bytes.length || bytes.length > MAX_RECEIPT_BYTES) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return 'image/png';
  if (new TextDecoder().decode(bytes.slice(0,5)) === '%PDF-') return 'application/pdf';
  return null;
}
export function canAttachReceipt(order: { user_id: string; paid_at?: string | null; status: string } | null, userId: string) {
  return !!order && order.user_id === userId && (!!order.paid_at || ['paid','processing','refunded'].includes(order.status));
}
export function evidenceSearch(value: string) {
  return value.trim().replace(/[,%_()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}