export const RENEWAL_ACTION = "[shadow-action:renew-server]";
export const SUPPORT_IDLE_MS = 5 * 3600_000;

function normalized(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
export function isServerRenewalRequest(text: string): boolean {
  const value = normalized(text);
  return /renov|mensalidade|taxa/.test(value) && /servidor|server|licen|login|btmob/.test(value);
}
export function customerConfirmedResolution(text: string): boolean {
  const value = normalized(text);
  if (/\bnao\b|ainda|pendente|aguard|erro|problema|mas|porem|falta|\?/.test(value)) return false;
  return /\bresolvido\b|\bresolveu\b|agora (funciona|funcionou)|deu certo|voltou a funcionar|consegui (renovar|entrar|acessar)/.test(value);
}
export type ResolutionMessage = { body: string | null; is_admin: boolean; is_system?: boolean; created_at: string };
/** Inactivity is never evidence of resolution. Only the newest customer reply counts. */
export function canAutoCloseSupport(messages: ResolutionMessage[], hasPendingPayment: boolean, now = Date.now()): boolean {
  if (hasPendingPayment || !messages.length) return false;
  const sorted = [...messages].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const latest = sorted[0];
  const customer = sorted.find((m) => !m.is_admin && !m.is_system);
  if (!latest || !customer || !customerConfirmedResolution(customer.body ?? "")) return false;
  return Number.isFinite(Date.parse(latest.created_at)) && now - Date.parse(latest.created_at) >= SUPPORT_IDLE_MS;
}