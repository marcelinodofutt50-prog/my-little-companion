// Helpers de identidade: nunca expor o e-mail completo do cliente na UI.
export function maskEmail(email?: string | null): string {
  if (!email) return "operator";
  const [user, domain] = email.split("@");
  if (!domain) return "operator";
  const head = user.slice(0, 2);
  const tld = domain.includes(".") ? domain.slice(domain.lastIndexOf(".")) : "";
  return `${head}${"•".repeat(Math.max(3, Math.min(user.length - 2, 6)))}@•••${tld}`;
}

/** Nome exibido: apelido escolhido pelo usuário, senão e-mail mascarado. */
export function displayIdentity(displayName?: string | null, email?: string | null): string {
  const nick = displayName?.trim();
  if (nick) return nick;
  return maskEmail(email);
}
