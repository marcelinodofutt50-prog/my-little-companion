/** UI isolation only; authorization remains enforced by authenticated RPCs and RLS. */
export function createAccountActions() {
  let account: string | null = null;
  let generation = 0;
  const pending = new Map<string, symbol>();

  return {
    enter(next: string | null) {
      if (next === account) return false;
      account = next;
      generation += 1;
      pending.clear();
      return true;
    },
    begin(key: string) {
      if (!account || pending.has(key)) return null;
      const visit = generation;
      const token = Symbol(key);
      pending.set(key, token);
      const isCurrent = () => visit === generation && pending.get(key) === token;
      return {
        isCurrent,
        finish() {
          if (!isCurrent()) return false;
          pending.delete(key);
          return true;
        },
      };
    },
    cancel() {
      account = null;
      generation += 1;
      pending.clear();
    },
  };
}
