/**
 * Autenticação dos endpoints de cron (/api/public/hooks/*).
 *
 * Regra de ouro: se CRON_TRIGGER_TOKEN não estiver configurado, NINGUÉM entra.
 * Sem essa checagem, um deploy sem a variável transformaria os hooks em
 * endpoints abertos (uma requisição sem header casaria com `undefined`).
 */

/** Lê o token do Authorization: Bearer ... ou do header x-cron-secret. */
function providedToken(request: Request): string {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer) return bearer.trim();
  return (request.headers.get("x-cron-secret") ?? "").trim();
}

/** true quando a requisição está autorizada a rodar o cron. */
export function isAuthorizedCron(request: Request): boolean {
  const expected = (process.env.CRON_SECRET ?? process.env.CRON_TRIGGER_TOKEN ?? "").trim();
  if (!expected || expected.length < 16) return false;
  const provided = providedToken(request);
  if (provided.length !== expected.length) return false;
  // Comparação em tempo constante: evita vazar o segredo por timing.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

/** Devolve uma Response 401 quando não autorizado, ou null quando pode seguir. */
export function cronUnauthorized(request: Request): Response | null {
  if (isAuthorizedCron(request)) return null;
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
