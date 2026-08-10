/**
 * Helpers de privacidade/anonimato compartilhados.
 * Nunca exponha e-mail completo de um usuário para outro usuário.
 */

/** Mascara e-mail para exibição entre usuários: ma***@gmail.com */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 1)}***@${domain}`;
}

/** Rótulo público de um usuário: apelido > e-mail mascarado > genérico. */
export function publicUserLabel(
  displayName: string | null | undefined,
  email: string | null | undefined,
): string {
  return displayName || maskEmail(email) || "Membro Shadow";
}
