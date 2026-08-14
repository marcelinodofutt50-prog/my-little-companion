/**
 * Detecção de uso indevido do TESTE GRÁTIS.
 *
 * O teste existe para o usuário validar o serviço em um aparelho próprio.
 * Quem usa o teste para atender terceiros ("instalar na pena", "no cliente",
 * "no bico") está revendendo sem licença — conduta proibida.
 *
 * REGRA DE OURO: nunca punir cliente legítimo. Por isso trabalhamos com
 * NÍVEIS DE CONFIANÇA:
 *   - "high"   -> declaração direta e inequívoca (única que revoga automaticamente)
 *   - "review" -> indício fraco; apenas registra para revisão humana
 *   - "none"   -> nada suspeito
 */

export type MisconductConfidence = "none" | "review" | "high";

export type MisconductMatch = {
  /** true quando há QUALQUER indício (fraco ou forte). */
  flagged: boolean;
  /** true somente quando a evidência é inequívoca (permite revogação automática). */
  actionable: boolean;
  confidence: MisconductConfidence;
  matched: string[];
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Contextos legítimos que NUNCA podem gerar punição.
 * Removidos do texto antes de qualquer análise.
 */
const LEGIT_CONTEXT: RegExp[] = [
  /\b(que|uma|e uma|foi uma)\s+pena\b/g,
  /\bpena\s+que\b/g,
  /\b(nao\s+)?vale\s+a\s+pena\b/g,
  /\bsou\s+(seu\s+|um\s+|novo\s+)?cliente\b/g,
  /\bcliente\s+(de\s+voces|do\s+site|novo|aqui|antigo)\b/g,
  /\batendimento\s+ao\s+cliente\b/g,
  /\bcliente\s+fiel\b/g,
];

/**
 * Declarações inequívocas de uso em terceiros / revenda.
 * Exigem verbo + alvo de terceiro na MESMA expressão (proximidade curta),
 * o que evita cruzar palavras soltas espalhadas na frase.
 */
const ACTION_WORDS =
  "(instal\\w*|coloc\\w*|coloq\\w*|bot\\w*|pass\\w*|ativ\\w*|aplic\\w*|configur\\w*|vend\\w*|revend\\w*)";
const THIRD_PARTY =
  "(penas?|bicos?|(meu?s?|minha?s?|dos?\\s+meus?)\\s+clientes?|clientes?\\s+(meu?s?|dele|dela|do\\s+meu)|freguesi\\w+|comprador\\w*)";

const HIGH_PATTERNS: Array<[string, RegExp]> = [
  // "instalar na pena", "coloquei no bico", "botar nos meus clientes"
  [
    "acao_em_terceiro",
    new RegExp(`\\b${ACTION_WORDS}\\b(?:\\s+\\w+){0,3}\\s+(?:n[ao]s?|em|pra|para|pro|no|na)\\s+${THIRD_PARTY}\\b`),
  ],
  // "muitas penas", "várias penas para colocar"
  ["volume_penas", /\b(muita|muitas|varias|umas|\d+)\s+penas?\b/],
  // revenda declarada
  ["revenda", /\brevend\w+/],
  ["repasse_licenca", /\brepass\w*\s+(o\s+|a\s+|meu\s+|minha\s+)?(login|licenca|acesso|conta|painel|teste)\b/],
  // "meus clientes" + contexto de uso do app
  ["meus_clientes_uso", /\b(meu?s?|minha?s?)\s+clientes?\b(?=.*\b(app|apk|painel|licenca|teste|login|acesso)\b)/],
];

/** Indícios fracos: registram para revisão, jamais revogam sozinhos. */
const REVIEW_PATTERNS: Array<[string, RegExp]> = [
  ["pena_isolada", /\bpenas?\b/],
  ["bico_isolado", /\bbicos?\b/],
  ["clientes_isolado", /\b(meu?s?|minha?s?)\s+clientes?\b/],
];

export function detectTrialMisconduct(rawMessage: string): MisconductMatch {
  const msg = normalize(rawMessage ?? "");
  if (!msg) return { flagged: false, actionable: false, confidence: "none", matched: [] };

  let cleaned = msg;
  for (const re of LEGIT_CONTEXT) cleaned = cleaned.replace(re, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (!cleaned) return { flagged: false, actionable: false, confidence: "none", matched: [] };

  const strong: string[] = [];
  for (const [label, re] of HIGH_PATTERNS) if (re.test(cleaned)) strong.push(label);

  if (strong.length > 0) {
    return { flagged: true, actionable: true, confidence: "high", matched: [...new Set(strong)] };
  }

  const weak: string[] = [];
  for (const [label, re] of REVIEW_PATTERNS) if (re.test(cleaned)) weak.push(label);

  if (weak.length > 0) {
    return { flagged: true, actionable: false, confidence: "review", matched: [...new Set(weak)] };
  }

  return { flagged: false, actionable: false, confidence: "none", matched: [] };
}
