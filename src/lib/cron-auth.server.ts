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
  const provided = providedToken(request);
  // Aceita qualquer um dos dois segredos (antes, com CRON_SECRET definido,
  // o CRON_TRIGGER_TOKEN era ignorado e o pg_cron recebia 401 em silêncio).
  const candidates = [process.env.CRON_SECRET, process.env.CRON_TRIGGER_TOKEN]
    .map((v) => (v ?? "").trim())
    .filter((v) => v.length >= 16);
  let ok = false;
  for (const expected of candidates) {
    if (provided.length !== expected.length) continue;
    // Comparação em tempo constante: evita vazar o segredo por timing.
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
    if (diff === 0) ok = true;
  }
  return ok;
}

/** Devolve uma Response 401 quando não autorizado, ou null quando pode seguir. */
export function cronUnauthorized(request: Request): Response | null {
  if (isAuthorizedCron(request)) return null;
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
