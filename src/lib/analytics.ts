/**
 * Tracking leve de eventos de UI.
 * - Envia para PostHog/gtag se existirem na página (opcional).
 * - Sempre guarda um contador local (últimos 200 eventos) para leitura rápida.
 * - Emite um CustomEvent("app:track") para quem quiser escutar.
 */
export type TrackProps = Record<string, string | number | boolean | null | undefined>;

const STORE_KEY = "shadow:events";
const MAX = 200;

export function track(event: string, props: TrackProps = {}) {
  if (typeof window === "undefined") return;
  const payload = { event, props, ts: Date.now() };

  try {
    const ph = (window as any).posthog;
    if (ph?.capture) ph.capture(event, props);
    const gtag = (window as any).gtag;
    if (typeof gtag === "function") gtag("event", event, props);
  } catch {
    /* tracking nunca pode quebrar a UI */
  }

  try {
    const raw = localStorage.getItem(STORE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    list.push(payload);
    localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* storage cheio ou indisponível */
  }

  try {
    window.dispatchEvent(new CustomEvent("app:track", { detail: payload }));
  } catch {
    /* ambientes sem CustomEvent */
  }
}

export function readTrackedEvents(): Array<{ event: string; props: TrackProps; ts: number }> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
