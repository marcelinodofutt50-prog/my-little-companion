import { describe, expect, it } from 'vitest';
import { DEFAULT_ORIGIN, safeNotificationOrigin, safeReturnOrigin, safeReturnUrl } from '../safe-origin';

describe('payment destination isolation', () => {
  it('does not trust arbitrary hosted projects', () => {
    expect(safeReturnOrigin('https://unrelated.vercel.app')).toBe(DEFAULT_ORIGIN);
    expect(safeReturnOrigin('https://unrelated.lovable.app')).toBe(DEFAULT_ORIGIN);
  });
  it('preserves the official origin and intended return path', () => {
    expect(safeReturnUrl('https://shadowdashstore.com/pagamento?order=123')).toBe('https://shadowdashstore.com/pagamento?order=123');
  });
  it('keeps external returns inside the official site', () => {
    expect(safeReturnUrl('https://attacker.example/return?order=123')).toBe(`${DEFAULT_ORIGIN}/return?order=123`);
  });
  it('never sends notifications to a caller-selected external host', () => {
    expect(safeNotificationOrigin('https://attacker.example')).toBe(DEFAULT_ORIGIN);
    expect(safeNotificationOrigin('https://unrelated.vercel.app')).toBe(DEFAULT_ORIGIN);
  });
  it('rejects malformed origins and domain spoofing', () => {
    expect(safeReturnOrigin('https://shadowdashstore.com.attacker.example')).toBe(DEFAULT_ORIGIN);
    expect(safeReturnUrl('javascript:alert(1)')).toBe(`${DEFAULT_ORIGIN}alert(1)`);
    expect(safeNotificationOrigin('not a url')).toBe(DEFAULT_ORIGIN);
  });
});
