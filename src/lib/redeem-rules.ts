// Regras puras dos códigos de resgate (cortesias da equipe).
// Compartilhadas entre a criação no painel, o resgate do cliente e os testes.

export type RedeemKind = "license_days" | "server_renewal";

export type RedeemCodeLike = {
  code: string;
  kind: RedeemKind | string;
  days?: number | null;
  plan_slug?: string | null;
  active?: boolean | null;
  uses?: number | null;
  max_uses?: number | null;
  expires_at?: string | null;
};

export type RedeemCheck =
  | { ok: true }
  | { ok: false; reason: "not_found" | "inactive" | "expired" | "used_up"; message: string };

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Código legível por telefone: SHDW-XXXX-XXXX (sem 0/O/1/I). */
export function generateRedeemCode(prefix = "SHDW"): string {
  const block = (n: number) =>
    Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
  return `${prefix}-${block(4)}-${block(4)}`;
}

export function normalizeRedeemCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function checkRedeemCode(code: RedeemCodeLike | null | undefined, now = Date.now()): RedeemCheck {
  if (!code) {
    return { ok: false, reason: "not_found", message: "Código não encontrado. Confira as letras e tente de novo." };
  }
  if (code.active === false) {
    return { ok: false, reason: "inactive", message: "Este código foi desativado pela equipe." };
  }
  if (code.expires_at && new Date(code.expires_at).getTime() <= now) {
    return { ok: false, reason: "expired", message: "Este código já venceu." };
  }
  const uses = Number(code.uses ?? 0);
  const max = Number(code.max_uses ?? 1);
  if (max > 0 && uses >= max) {
    return { ok: false, reason: "used_up", message: "Este código já atingiu o limite de usos." };
  }
  return { ok: true };
}

/** Rótulo curto do benefício, usado no painel e na confirmação ao cliente. */
export function describeRedeemCode(code: RedeemCodeLike): string {
  if (code.kind === "server_renewal") return "Renovação do servidor (até o próximo dia 20)";
  const d = Number(code.days ?? 0);
  return `Licença de ${d} dia${d === 1 ? "" : "s"}`;
}

/** Nova expiração ao aplicar dias de cortesia (soma sobre o que ainda resta). */
export function extendedExpiry(currentExpiresAt: string | null | undefined, days: number, now = Date.now()): Date {
  const base = currentExpiresAt ? Math.max(now, new Date(currentExpiresAt).getTime()) : now;
  return new Date(base + Math.max(1, days) * 86400000);
}
