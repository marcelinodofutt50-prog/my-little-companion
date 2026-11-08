/** Local hints only; server-side authentication limits remain authoritative. */
const COOLDOWN_KEY = "shadow.auth.emailCooldownUntil";
const ATTEMPTS_KEY = "shadow.auth.emailAttempts";

function keyFor(base: string, email: string): string | null {
  const normalized = email.trim().toLowerCase();
  return normalized ? `${base}:${normalized}` : null;
}

function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function write(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* Optional local hint. */ }
}

function recentAttempts(email: string, now: number): number[] {
  const key = keyFor(ATTEMPTS_KEY, email);
  if (!key) return [];
  try {
    const value: unknown = JSON.parse(read(key) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t <= now && now - t < 3600_000);
  } catch { return []; }
}

export function readCooldown(email: string): number {
  const key = keyFor(COOLDOWN_KEY, email);
  if (!key) return 0;
  const until = Number(read(key));
  return Number.isFinite(until) ? Math.max(0, Math.min(60, Math.ceil((until - Date.now()) / 1000))) : 0;
}

export function writeCooldown(email: string, secs: number) {
  const key = keyFor(COOLDOWN_KEY, email);
  if (key) write(key, String(Date.now() + secs * 1000));
}

export function bumpAttempts(email: string): number {
  const key = keyFor(ATTEMPTS_KEY, email);
  if (!key) return 0;
  const now = Date.now();
  const list = [...recentAttempts(email, now), now];
  write(key, JSON.stringify(list));
  return list.length;
}

export function attemptsInfo(email: string): { count: number; last: number | null } {
  const list = recentAttempts(email, Date.now());
  return { count: list.length, last: list.length ? Math.max(...list) : null };
}

export function clearStoredLimits(email: string) {
  for (const base of [COOLDOWN_KEY, ATTEMPTS_KEY]) {
    const key = keyFor(base, email);
    if (key) {
      try { window.localStorage.removeItem(key); } catch { /* Optional local hint. */ }
    }
  }
}