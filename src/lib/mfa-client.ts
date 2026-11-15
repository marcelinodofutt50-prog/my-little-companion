const TRUST_PREFIX = "shadow:mfa-trust:";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function trustedDeviceKey(userId: string) {
  return `${TRUST_PREFIX}${userId}`;
}

export function readTrustedDeviceToken(userId: string, storage: StorageLike | null = browserStorage()) {
  if (!storage) return null;
  try {
    return storage.getItem(trustedDeviceKey(userId));
  } catch {
    return null;
  }
}

export function writeTrustedDeviceToken(userId: string, token: string, storage: StorageLike | null = browserStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(trustedDeviceKey(userId), token);
    return true;
  } catch {
    return false;
  }
}

export function removeTrustedDeviceToken(userId: string, storage: StorageLike | null = browserStorage()) {
  if (!storage) return;
  try {
    storage.removeItem(trustedDeviceKey(userId));
  } catch {
    // Local storage is optional; server-side MFA still applies.
  }
}

export function clearTrustedDeviceTokens(storage: Storage | null = browserStorage()) {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(TRUST_PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      try { storage.removeItem(key); } catch { /* Optional local hint. */ }
    }
  } catch {
    // Local storage is optional; server-side MFA still applies.
  }
}

export function normalizeMfaCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function mfaVerificationMessage(error: unknown) {
  const source = error as { message?: string; status?: number; code?: string } | null;
  const message = String(source?.message ?? "").toLowerCase();
  if (source?.status === 429 || source?.code === "over_request_rate_limit" || /rate limit|too many/.test(message)) {
    return "Muitas tentativas. Aguarde um pouco antes de tentar novamente.";
  }
  if (/invalid|expired|token|otp|code/.test(message)) {
    return "Código incorreto ou vencido. Confira o horário do celular e o código atual do app.";
  }
  if (/fetch|network|connection|timeout|failed/.test(message)) {
    return "Não foi possível conectar para confirmar o código. Verifique sua internet e tente novamente.";
  }
  return "Não foi possível confirmar o código agora. Tente novamente.";
}

export function trustedDeviceLabel() {
  try {
    const platform = navigator.platform || "Dispositivo";
    const browser = navigator.userAgent.match(/(Chrome|Firefox|Safari|Edg|OPR)\/[\d]+/)?.[0] ?? "navegador";
    return `${platform} · ${browser}`.slice(0, 80);
  } catch {
    return "Dispositivo";
  }
}
