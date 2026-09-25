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
