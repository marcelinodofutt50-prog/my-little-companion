/** Synchronous locks are per visit; an old completion cannot unlock a new visit. */
export function createChatOperations() {
  let visit: object = {};
  const locks = new Set<string>();
  return {
    reset() {
      visit = {};
      locks.clear();
    },
    begin(key: string): (() => void) | null {
      if (locks.has(key)) return null;
      locks.add(key);
      const startedVisit = visit;
      return () => {
        if (visit === startedVisit) locks.delete(key);
      };
    },
  };
}

/** Storage is optional: a denied read must still clear the previous conversation. */
export function readChatDraft(key: string, storage: Pick<Storage, "getItem"> | null): string {
  try {
    return (storage?.getItem(key) ?? "").slice(0, 4000);
  } catch {
    return "";
  }
}