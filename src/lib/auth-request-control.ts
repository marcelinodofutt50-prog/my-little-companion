/** Shares only concurrent work; completed identity results are never cached. */
export function singleFlight<T>(request: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    if (pending) return pending;
    const current = Promise.resolve().then(request);
    pending = current;
    const clear = () => { if (pending === current) pending = undefined; };
    void current.then(clear, clear);
    return current;
  };
}

/** SIGNED_IN can also fire when focusing an already signed-in tab. */
export function createAuthTransitionFilter() {
  let initialized = false;
  let userId: string | null = null;
  return (event: string, nextId: string | null): boolean => {
    if (event === "INITIAL_SESSION") {
      userId = nextId;
      initialized = true;
      return false;
    }
    if (event === "USER_UPDATED" || event === "MFA_CHALLENGE_VERIFIED") return true;
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return false;
    const changed = !initialized || nextId !== userId;
    userId = nextId;
    initialized = true;
    return changed;
  };
}

export function isChunkLoadError(message: string): boolean {
  return /failed to fetch dynamically imported module|error loading dynamically imported module|chunkloaderror/i.test(message);
}