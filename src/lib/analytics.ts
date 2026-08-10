/**
 * Tracking leve de eventos de UI.
 * - Envia para PostHog/gtag se existirem na página (opcional).
 * - Sempre guarda um contador local (últimos 200 eventos) para leitura rápida.
 * - Emite um CustomEvent("app:track") para quem quiser escutar.
 */
export type TrackProps = Record<string, string | number | boolean | null | undefined>;

const STORE_KEY = "shadow:events";
const MAX = 200;

/** Chaves que jamais devem ser gravadas/enviadas junto de um evento. */
const PII_KEYS = /^(email|e_mail|mail|user_id|userid|uid|cpf|phone|telefone|pix|pix_key|password|senha|token|full_name|nome)$/i;

function scrub(props: TrackProps): TrackProps {
  const out: TrackProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (PII_KEYS.test(k)) continue;
    if (typeof v === "string" && (v.includes("@") || v.length > 120)) continue;
    out[k] = v;
  }
  return out;
}

/** Apaga o histórico local de eventos (chamado no logout). */
export function clearTrackedEvents() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORE_KEY);
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* storage indisponível */
  }
}

export function track(event: string, props: TrackProps = {}) {
  if (typeof window === "undefined") return;
  const safeProps = scrub(props);
  const payload = { event, props: safeProps, ts: Date.now() };

  try {
    const ph = (window as any).posthog;
    if (ph?.capture) ph.capture(event, safeProps);
    const gtag = (window as any).gtag;
    if (typeof gtag === "function") gtag("event", event, safeProps);
  } catch {
    /* tracking nunca pode quebrar a UI */
  }

  try {
    // sessionStorage: o rastro morre ao fechar a aba, não fica no aparelho.
    const raw = sessionStorage.getItem(STORE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    list.push(payload);
    sessionStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-MAX)));
    localStorage.removeItem(STORE_KEY); // limpa rastro antigo de versões anteriores
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
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
