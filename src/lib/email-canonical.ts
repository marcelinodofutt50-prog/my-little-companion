/**
 * Normalização de e-mail para evitar contas duplicadas.
 *
 * Gmail ignora pontos e tudo depois de "+", então
 * "jo.ao+teste@gmail.com" e "joao@gmail.com" são a MESMA caixa.
 * Sem isso o cliente consegue criar várias contas com o mesmo Gmail.
 */

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function splitEmail(email: string): { local: string; domain: string } | null {
  const clean = (email ?? "").trim().toLowerCase();
  const at = clean.lastIndexOf("@");
  if (at <= 0 || at === clean.length - 1) return null;
  return { local: clean.slice(0, at), domain: clean.slice(at + 1) };
}

/** Forma canônica: mesma caixa de entrada → mesma string. */
export function canonicalEmail(email: string): string | null {
  const parts = splitEmail(email);
  if (!parts) return null;
  let { local } = parts;
  const { domain } = parts;
  // "+tag" é ignorado por praticamente todos os provedores
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./g, "");
    return `${local}@gmail.com`;
  }
  if (!local) return null;
  return `${local}@${domain}`;
}

/** True quando dois e-mails caem na mesma caixa de entrada. */
export function sameInbox(a: string, b: string): boolean {
  const ca = canonicalEmail(a);
  const cb = canonicalEmail(b);
  return !!ca && !!cb && ca === cb;
}
