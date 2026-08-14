/**
 * Detecção de uso indevido do TESTE GRÁTIS.
 *
 * O teste existe para o usuário validar o serviço em um aparelho próprio.
 * Quem usa o teste para atender terceiros ("instalar na pena", "no cliente",
 * "no bico") está revendendo sem licença — conduta proibida.
 *
 * Regra de ouro: NÃO barrar cliente real. Só marcamos quando há um verbo de
 * instalação/uso somado a um alvo de terceiro, ou uma expressão inequívoca.
 */

export type MisconductMatch = {
  flagged: boolean;
  matched: string[];
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Expressões inequívocas de revenda/uso em terceiros. */
const STRONG_PATTERNS: Array<[string, RegExp]> = [
  ["na_pena", /\b(n[ao]s?|em|pra|para|pro)\s+pena\b/],
  ["muita_pena", /\b(muita|varias|v[aá]rias|umas|umas?\s+\d+)\s+penas?\b/],
  ["pena_plural", /\bpenas\b/],
  ["no_bico", /\b(n[ao]s?|em|pra|para|pro)\s+bicos?\b/],
  ["revenda", /\b(revend|repass)\w*/],
  ["meus_clientes", /\b(meu|meus|minha|minhas)\s+(cliente|clientes|freguesi\w+)\b/],
  ["cliente_alheio", /\bcliente\s+(dele|dela|do\s+meu|de\s+um)\b/],
];

/** Verbos de instalação/aplicação. */
const ACTION = /\b(instal\w*|coloc\w*|bot\w*|pass\w*|ativ\w*|us\w*|log\w*|test\w*|aplic\w*)\b/;
/** Alvos que indicam terceiros. */
const TARGET = /\b(pena|penas|bico|bicos|cliente|clientes|fregues\w*|comprador\w*)\b/;

/** Contextos legítimos que NÃO devem disparar (ex.: "que pena", suporte falando). */
const FALSE_POSITIVE = /\b(que\s+pena|uma\s+pena|pena\s+que|vale\s+a\s+pena|nao\s+vale\s+a\s+pena)\b/;

export function detectTrialMisconduct(rawMessage: string): MisconductMatch {
  const msg = normalize(rawMessage ?? "");
  if (!msg) return { flagged: false, matched: [] };

  const matched: string[] = [];
  const cleaned = msg.replace(FALSE_POSITIVE, " ");

  for (const [label, re] of STRONG_PATTERNS) {
    if (re.test(cleaned)) matched.push(label);
  }

  if (ACTION.test(cleaned) && TARGET.test(cleaned)) matched.push("acao_em_terceiro");

  return { flagged: matched.length > 0, matched: [...new Set(matched)] };
}
