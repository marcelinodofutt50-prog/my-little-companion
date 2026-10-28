export class CreatorReadTimeout extends Error {
  constructor() { super("creator_read_timeout"); }
}

function isTransient(error: unknown): boolean {
  if (error instanceof CreatorReadTimeout || error instanceof TypeError) return true;
  if (!error || typeof error !== "object") return false;
  const value = error as { status?: number; message?: string };
  return [408, 502, 503, 504].includes(value.status ?? 0)
    || /failed to fetch|networkerror|network request failed/i.test(value.message ?? "");
}

/** Read-only recovery: at most two attempts, each bounded and cancelled with its page visit. */
export async function recoverCreatorRead<T>(
  read: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    signal.throwIfAborted();
    const request = new AbortController();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => request.abort(signal.reason);
    signal.addEventListener("abort", cancel, { once: true });
    const interrupted = new Promise<never>((_, reject) => {
      request.signal.addEventListener("abort", () => reject(
        timedOut ? new CreatorReadTimeout() : request.signal.reason,
      ), { once: true });
      timer = setTimeout(() => { timedOut = true; request.abort(); }, 12_000);
    });
    try {
      return await Promise.race([read(request.signal), interrupted]);
    } catch (error) {
      signal.throwIfAborted();
      if (attempt > 0 || !isTransient(error)) throw error;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
    }
    await new Promise<void>((resolve, reject) => {
      const cancelWait = () => { clearTimeout(wait); reject(signal.reason); };
      const wait = setTimeout(() => { signal.removeEventListener("abort", cancelWait); resolve(); }, 500);
      signal.addEventListener("abort", cancelWait, { once: true });
      if (signal.aborted) { signal.removeEventListener("abort", cancelWait); cancelWait(); }
    });
  }
  throw new CreatorReadTimeout();
}
