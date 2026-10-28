import { describe, expect, it } from 'vitest';
import { createAccountActions } from '../account-actions';

describe('account action isolation', () => {
  it('blocks operations without an account', () => {
    expect(createAccountActions().begin('remove')).toBeNull();
  });
  it('locks concurrent operations synchronously', () => {
    const actions = createAccountActions();
    actions.enter('A');
    const first = actions.begin('remove');
    expect(first?.isCurrent()).toBe(true);
    expect(actions.begin('remove')).toBeNull();
    expect(first?.finish()).toBe(true);
    expect(actions.begin('remove')?.isCurrent()).toBe(true);
  });
  it('does not reactivate old work after A → B → A', () => {
    const actions = createAccountActions();
    actions.enter('A');
    const old = actions.begin('review');
    actions.enter('B');
    actions.enter('A');
    const current = actions.begin('review');
    expect(old?.isCurrent()).toBe(false);
    expect(old?.finish()).toBe(false);
    expect(current?.isCurrent()).toBe(true);
    expect(actions.begin('review')).toBeNull();
  });
  it('preserves work on repeated auth events for the same account', () => {
    const actions = createAccountActions();
    actions.enter('A');
    const current = actions.begin('remove');
    expect(actions.enter('A')).toBe(false);
    expect(current?.isCurrent()).toBe(true);
  });
  it('invalidates completion on sign-out and unmount', () => {
    const actions = createAccountActions();
    actions.enter('A');
    const signedOut = actions.begin('remove');
    actions.enter(null);
    expect(signedOut?.isCurrent()).toBe(false);
    actions.enter('A');
    const unmounted = actions.begin('remove');
    actions.cancel();
    expect(unmounted?.finish()).toBe(false);
  });
  it('does not clear another account draft after a delayed response', async () => {
    const actions = createAccountActions();
    actions.enter('A');
    const old = actions.begin('review');
    let resolve: (() => void) | undefined;
    const response = new Promise<void>((done) => { resolve = done; });
    let note = 'A';
    const save = response.then(() => { if (old?.isCurrent()) note = ''; });
    actions.enter('B');
    note = 'B';
    resolve?.();
    await save;
    expect(note).toBe('B');
  });
});
