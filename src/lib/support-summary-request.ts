export type ThreadSummaryRequest = {
  threadId: string;
  generation: number;
};

/**
 * Invalidates pending summary/escalation completions when the ticket changes.
 * A newer operation in the same ticket also supersedes the previous one.
 */
export function createThreadSummaryRequestGuard(initialThreadId: string) {
  let activeThreadId = initialThreadId;
  let generation = 0;

  const enter = (threadId: string) => {
    if (threadId === activeThreadId) return;
    activeThreadId = threadId;
    generation += 1;
  };

  return {
    enter,
    begin(threadId: string): ThreadSummaryRequest {
      enter(threadId);
      return { threadId, generation: ++generation };
    },
    isCurrent(request: ThreadSummaryRequest): boolean {
      return request.threadId === activeThreadId && request.generation === generation;
    },
    cancel() {
      generation += 1;
    },
  };
}
