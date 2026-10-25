import { describe, it, expect } from 'vitest';
import { canAttachReceipt, receiptMime, MAX_RECEIPT_BYTES, evidenceSearch } from './purchase-evidence-rules';
describe('private optional purchase receipts', () => {
  it('does not accept another customer order', () => {
    expect(canAttachReceipt({ user_id:'other', status:'paid' }, 'me')).toBe(false);
    expect(canAttachReceipt({ user_id:'me', status:'paid' }, 'me')).toBe(true);
  });
  it('does not treat a receipt as payment approval', () => {
    expect(canAttachReceipt({ user_id:'me', status:'pending' }, 'me')).toBe(false);
    expect(canAttachReceipt({ user_id:'me', status:'pending', paid_at:'2026-10-25' }, 'me')).toBe(true);
  });
  it('checks file signatures and enforces five MiB', () => {
    expect(MAX_RECEIPT_BYTES).toBe(5242880);
    expect(receiptMime(new TextEncoder().encode('<svg>fake.png'))).toBe(null);
    expect(receiptMime(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf');
    expect(receiptMime(new Uint8Array([137,80,78,71,13,10,26,10]))).toBe('image/png');
    expect(receiptMime(new Uint8Array([255,216,255,0]))).toBe('image/jpeg');
    expect(receiptMime(new Uint8Array(MAX_RECEIPT_BYTES + 1))).toBe(null);
  });
  it('keeps search text from changing query filters', () => {
    expect(evidenceSearch('Eliane%,(Silva)_')).toBe('Eliane Silva');
  });
});