/**
 * Política de senha do login BTmob/Yaarsa.
 *
 * O painel só aceita letras, números e @ # . _ - — por isso a lista de
 * especiais é fechada. Antes bastava ter 6 caracteres, então dava para colocar
 * só números; agora exigimos maiúscula, minúscula, número e um especial.
 *
 * Este arquivo é seguro para o navegador: a mesma checagem roda na tela e no
 * servidor, sem mensagens diferentes entre os dois.
 */

export const PASSWORD_SPECIALS = "@#._-";
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 32;

export type PasswordRule = { id: string; label: string; ok: boolean };

export function passwordRules(value: string): PasswordRule[] {
  const v = value ?? "";
  return [
    { id: "len", label: `Mínimo de ${PASSWORD_MIN} caracteres`, ok: v.length >= PASSWORD_MIN && v.length <= PASSWORD_MAX },
    { id: "upper", label: "Pelo menos 1 letra maiúscula", ok: /[A-Z]/.test(v) },
    { id: "lower", label: "Pelo menos 1 letra minúscula", ok: /[a-z]/.test(v) },
    { id: "digit", label: "Pelo menos 1 número", ok: /[0-9]/.test(v) },
    { id: "special", label: `Pelo menos 1 especial (${PASSWORD_SPECIALS.split("").join(" ")})`, ok: /[@#._-]/.test(v) },
    { id: "charset", label: "Só letras, números e @ # . _ -", ok: v.length > 0 && /^[A-Za-z0-9@#._-]+$/.test(v) },
  ];
}

export function isPasswordValid(value: string): boolean {
  return passwordRules(value).every((r) => r.ok);
}

/** Primeira regra quebrada, em texto pronto para o cliente. */
export function passwordError(value: string): string | null {
  const broken = passwordRules(value).find((r) => !r.ok);
  return broken ? broken.label : null;
}
