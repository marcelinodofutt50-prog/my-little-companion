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
    /(n[ãa]o (consigo|consegui|est[áa] |ta |t[áa] |abre|abriu|carrega|funciona|vai|deu)|erro|falha|travou|travando|bug|problema|indispon[íi]vel|n[ãa]o abre|nao abre|deu ruim|d[áa] erro|nada acontece)/.test(
      t,
    );
  return payment && failure;
}
