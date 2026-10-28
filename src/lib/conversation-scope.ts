/** A visit is invalidated on conversation/account change, including A → B → A. */
export function createConversationScope() {
  let key: string | undefined;
  let generation = 0;
  return {
    enter(nextKey: string): () => boolean {
      if (key !== nextKey) {
        key = nextKey;
        generation += 1;
      }
      const visit = generation;
      return () => generation === visit && key === nextKey;
    },
    cancel() {
      key = undefined;
      generation += 1;
    },
  };
}
