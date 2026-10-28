/** Aceita só origens do próprio site para o retorno do pagamento (evita redirecionar para sites falsos). */
const ALLOWED = [/^https:\/\/(www\.)?shadowdashstore\.com$/i, /^https:\/\/[a-z0-9-]+\.lovable\.app$/i, /^https:\/\/[a-z0-9-]+\.vercel\.app$/i, /^http:\/\/localhost(:\d+)?$/i];
export const DEFAULT_ORIGIN = "https://www.shadowdashstore.com";
export function safeReturnOrigin(input: string): string {
  try {
    const o = new URL(input).origin;
    return ALLOWED.some((r) => r.test(o)) ? o : DEFAULT_ORIGIN;
  } catch {
    return DEFAULT_ORIGIN;
  }
}

/** Aceita uma URL completa de retorno apenas se a origem for confiável; senão mantém o caminho no site oficial. */
export function safeReturnUrl(input: string): string {
  try {
    const u = new URL(input);
    const origin = safeReturnOrigin(u.origin);
    return `${origin}${u.pathname}${u.search}`;
  } catch {
    return DEFAULT_ORIGIN;
  }
}

const NOTIFY_ALLOWED = [/^https:\/\/(www\.)?shadowdashstore\.com$/i, /^http:\/\/localhost(:\d+)?$/i];

/**
 * Origem usada para notificações de pagamento (webhook). Nunca vem de um
 * subdomínio livre: só o domínio oficial (ou localhost em desenvolvimento).
 */
export function safeNotificationOrigin(input: string): string {
  try {
    const o = new URL(input).origin;
    return NOTIFY_ALLOWED.some((r) => r.test(o)) ? o : DEFAULT_ORIGIN;
  } catch {
    return DEFAULT_ORIGIN;
  }
}
