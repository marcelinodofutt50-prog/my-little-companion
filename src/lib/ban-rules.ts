// Regras puras (sem servidor) do banimento por múltiplas contas.
export const MULTI_ACCOUNT_BAN_THRESHOLD = 4;
export const DEFAULT_BAN_PRICE_MULTIPLIER = 1.5;
export const TRIAL_DURATION_MS = 3.5 * 60 * 60 * 1000;
export const TRIAL_TERMS_VERSION = "v2-3h30";
export const TRIAL_CONSENT_MAX_AGE_MS = 30 * 60 * 1000;

export function shouldBanGroup(groupSize: number): boolean {
  return groupSize >= MULTI_ACCOUNT_BAN_THRESHOLD;
}

export function applyBanMultiplier(amount: number, multiplier: number | null | undefined): number {
  const m = Number(multiplier);
  if (!Number.isFinite(m) || m <= 1) return amount;
  return Math.round(amount * m * 100) / 100;
}

const COMMUNITY_BLOCK_PATTERNS: Array<[RegExp, string]> = [
  [/\b(vend[oe]|vendendo|revend|compro|comprar|pix|pagamento)\b/i, "venda"],
  [/\b\d+\s*(conto|contos|reais|real|pila|pilas)\b|r\$\s*\d/i, "preço"],
  [/\b(discord|dc|whats?app|wpp|zap|telegram|tg|insta(gram)?|facebook|fb)\b/i, "contato externo"],
  [/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|gg|io|me|xyz|br|site|store)\b/i, "link"],
  [/\b(pena|penas|acesso\s+di[aá]rio|login\s+barato)\b/i, "revenda de acesso"],
  [/(\+?55)?\s*\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}/, "telefone"],
];

export function checkCommunityContent(text: string): { ok: true } | { ok: false; reason: string } {
  const norm = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  for (const [re, reason] of COMMUNITY_BLOCK_PATTERNS) {
    if (re.test(norm)) return { ok: false, reason };
  }
  return { ok: true };
}
