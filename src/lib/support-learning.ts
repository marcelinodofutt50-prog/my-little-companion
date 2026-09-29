/**
 * Regras puras do aprendizado do robô do suporte: decidem se uma resposta da
 * equipe vira conhecimento e removem dados pessoais antes de gravar.
 */

export type ThreadMsg = { body: string | null; is_admin: boolean; is_system: boolean };

const MIN_QUESTION = 10;
const MIN_ANSWER = 25;
const MAX_LEN = 1200;

/** Esconde e-mails, senhas, PINs, códigos e chaves longas. */
export function redactPersonalData(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .replace(/\b(senha|password|pass|pin|c[oó]digo|token)\s*[:=é]?\s*\S+/gi, "$1: [oculto]")
    .replace(/\b(TRL|APK)-\d{6}-[A-Z0-9]+\b/gi, "[protocolo]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[id]")
    .replace(/\b\d{9,}\b/g, "[número]")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, MAX_LEN);
}

/** Respostas genéricas que não ensinam nada. */
const FILLER = /^(ok+|blz|beleza|certo|pronto|feito|obrigad[oa]|valeu|vlw|disponha|de nada|um momento|aguarde|j[aá] vejo|vou verificar|s[oó] um instante)[\s.!,]*$/i;

/**
 * A partir das mensagens da conversa (ordem cronológica, SEM a resposta nova),
 * junta o que o cliente escreveu desde a última fala da equipe.
 */
export function collectCustomerQuestion(history: ThreadMsg[]): string {
  const parts: string[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.is_system) continue; // falas do robô não separam a pergunta
    if (m.is_admin) {
      if (parts.length) break;
      continue;
    }
    if (m.body?.trim()) parts.unshift(m.body.trim());
    if (parts.length >= 4) break;
  }
  return parts.join("\n");
}

export function buildKnowledgeEntry(
  history: ThreadMsg[],
  staffReply: string,
): { question: string; answer: string } | null {
  const answerRaw = (staffReply ?? "").trim();
  if (answerRaw.length < MIN_ANSWER || FILLER.test(answerRaw)) return null;
  const questionRaw = collectCustomerQuestion(history);
  if (questionRaw.length < MIN_QUESTION) return null;
  const question = redactPersonalData(questionRaw);
  const answer = redactPersonalData(answerRaw);
  if (question.length < MIN_QUESTION || answer.length < MIN_ANSWER) return null;
  return { question, answer };
}

/** Texto que entra no prompt do robô com os casos parecidos já resolvidos. */
export function formatKnowledgeForPrompt(items: { question: string; answer: string }[]): string {
  if (!items.length) return "";
  return [
    "CASOS PARECIDOS JÁ RESOLVIDOS PELA EQUIPE (use como referência de solução, adapte ao cliente, não copie dados de outro cliente):",
    ...items.map((k, i) => `${i + 1}. Cliente: ${k.question.slice(0, 400)}\n   Equipe respondeu: ${k.answer.slice(0, 600)}`),
  ].join("\n");
}
