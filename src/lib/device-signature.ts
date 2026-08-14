/**
 * Assinatura de aparelho (client-safe).
 *
 * Duas partes independentes, para que burlar uma não derrube a outra:
 *  1. `deviceId` — identificador aleatório persistido em localStorage + cookie.
 *     Some ao limpar dados/anônima, por isso não é a única camada.
 *  2. `attrs` — características estáveis do navegador/aparelho (tela, fuso,
 *     idioma, núcleos, memória, plataforma). Não identifica a pessoa sozinha,
 *     mas combinada com rede/IP liga contas criadas no mesmo aparelho.
 *
 * Nada aqui é enviado em claro para o banco: o servidor aplica hash com salt.
 */

const KEY = "sd_device_id";
const COOKIE = "sd_did";

export type DeviceSignature = { deviceId: string; attrs: string };

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 730}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

function readOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id: string | null = null;
  try {
    id = window.localStorage.getItem(KEY);
  } catch {
    /* storage bloqueado */
  }
  if (!id) id = readCookie(COOKIE);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
  writeCookie(COOKIE, id);
  return id;
}

function collectAttrs(): string {
  if (typeof window === "undefined") return "";
  const n = navigator as any;
  const s = window.screen;
  const parts = [
    s ? `${s.width}x${s.height}x${s.colorDepth}` : "",
    String(window.devicePixelRatio ?? ""),
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    (navigator.languages ?? [navigator.language]).slice(0, 3).join(","),
    n.platform ?? "",
    String(n.hardwareConcurrency ?? ""),
    String(n.deviceMemory ?? ""),
    String(n.maxTouchPoints ?? ""),
    // engine/família do navegador, sem versão (evita mudar a cada update)
    (navigator.userAgent || "").replace(/[\d._]+/g, ""),
  ];
  return parts.join("|");
}

/** Coleta a assinatura do aparelho. Nunca lança — falha vira string vazia. */
export function getDeviceSignature(): DeviceSignature {
  try {
    return { deviceId: readOrCreateDeviceId(), attrs: collectAttrs() };
  } catch {
    return { deviceId: "", attrs: "" };
  }
}
