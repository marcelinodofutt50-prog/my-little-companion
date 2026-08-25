/**
 * Dados oficiais do PIX da Shadow (fallback quando o checkout falha).
 * Client-safe: sem segredos, só a chave pública de recebimento.
 */
export const SHADOW_PIX = {
  key: "bbfccc7e-73d6-4d19-ab8e-ac069ef622a4",
  keyType: "Aleatória",
  holder: "Bruno Gomes",
} as const;

export function buildPixInstructions(): string {
  return [
    "Vi que o checkout não abriu aí. Pode pagar direto no nosso PIX:",
    "",
    `• **Chave PIX (aleatória):** \`${SHADOW_PIX.key}\``,
    `• **Nome:** ${SHADOW_PIX.holder}`,
    "",
    "1. Envie o valor exato do produto que quer comprar.",
    "2. Mande aqui no chat o **nome do produto** + o **comprovante**.",
    "3. Assim que confirmarmos, liberamos seu acesso manualmente. ⚡",
  ].join("\n");
}

/** Detecta relatos de falha no checkout / dificuldade para pagar. */
export function isCheckoutFailureMessage(text: string): boolean {
  const t = (text || "").toLowerCase();
  const payment = /(checkout|pagamento|pagar|comprar|compra|mercado ?pago|stripe|cart[ãa]o|pix|assinatura|renovar)/.test(t);
  const failure =
    /(n[ãa]o\s+(\w+\s+){0,2}(consig\w*|consegu\w*|est[áa]|ta|t[áa]|abre|abriu|carrega|funciona|vai|deu|rola|d[áa])|erro|falha|travou|travando|bug|problema|indispon[íi]vel|deu ruim|nada acontece)/.test(
      t,
    );
  return payment && failure;
}

/** Marcador invisível para identificar que já oferecemos o PIX na conversa. */
export const PIX_OFFER_MARKER = "[pix-offer]";

/** Pergunta de confirmação enviada ANTES de mandar a chave PIX. */
export function buildPixOffer(): string {
  return [
    "Pelo que entendi, o checkout não está abrindo/concluindo aí, certo?",
    "",
    "Posso te enviar nossa **chave PIX** para pagar direto por aqui?",
    "",
    "Responda **sim** que eu mando a chave e o passo a passo. ⚡",
    PIX_OFFER_MARKER,
  ].join("\n");
}

/** Resposta afirmativa curta do cliente ("sim", "pode mandar", "manda aí"...). */
export function isAffirmativeReply(text: string): boolean {
  const t = (text || "").toLowerCase().trim();
  if (!t || t.length > 120) return false;
  return /(^|\b)(sim|isso|claro|quero|pode(\s+(mandar|enviar|ser|mander))?|manda|manda[r]?\s+(a[ií]|a chave|o pix)|envia|bora|blz|beleza|ok|okay|por favor|pfv|pfvr|aceito|positivo|s[ií]m)(\b|$)/.test(t);
}

/** Cliente pedindo o PIX explicitamente (não precisa de confirmação). */
export function isExplicitPixRequest(text: string): boolean {
  const t = (text || "").toLowerCase();
  return /(manda|envia|passa|qual|quero|me\s+d[áa])[^.!?]{0,20}\b(pix|chave)\b/.test(t)
    || /\bchave\s+pix\b/.test(t);
}
