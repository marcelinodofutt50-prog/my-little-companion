import { describe, expect, it } from 'vitest';
import { createLatestRequest } from '../latest-request';

describe('latest request isolation', () => {
  it('only accepts the newest search response', () => {
    const gate = createLatestRequest();
    const first = gate.begin();
    const second = gate.begin();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });
  it('rejects a response after clearing or closing search', () => {
    const gate = createLatestRequest();
    const current = gate.begin();
    gate.cancel();
    expect(current()).toBe(false);
  });
  it('accepts a new search after cancellation', () => {
    const gate = createLatestRequest();
    gate.begin();
    gate.cancel();
    expect(gate.begin()()).toBe(true);
  });
});