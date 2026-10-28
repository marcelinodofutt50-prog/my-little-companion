import { describe, expect, it } from 'vitest';
import { createConversationScope } from '../conversation-scope';

describe('conversation visit isolation', () => {
  it('does not reactivate an old upload after A → B → A', async () => {
    const scope = createConversationScope();
    const oldA = scope.enter('user:A');
    let finish: (() => void) | undefined;
    const uploaded = new Promise<void>((resolve) => { finish = resolve; });
    let draft = 'rascunho A';
    const send = uploaded.then(() => { if (oldA()) draft = ''; });
    scope.enter('user:B');
    scope.enter('user:A');
    draft = 'novo rascunho A';
    finish?.();
    await send;
    expect(draft).toBe('novo rascunho A');
    expect(oldA()).toBe(false);
  });
  it('retains the visit across renders of the same conversation', () => {
    const scope = createConversationScope();
    const first = scope.enter('user:A');
    expect(scope.enter('user:A')()).toBe(true);
    expect(first()).toBe(true);
  });
  it('invalidates work on account changes and unmount', () => {
    const scope = createConversationScope();
    const first = scope.enter('user:A');
    scope.enter('other-user:A');
    expect(first()).toBe(false);
    const current = scope.enter('other-user:A');
    scope.cancel();
    expect(current()).toBe(false);
  });
});
