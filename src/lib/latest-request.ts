/** Each request remains valid only until a newer request or explicit cancellation. */
export function createLatestRequest() {
  let generation = 0;
  return {
    begin() {
      const current = ++generation;
      return () => current === generation;
    },
    cancel() { generation += 1; },
  };
}