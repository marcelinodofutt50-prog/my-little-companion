/**
 * Traduz códigos de erro do painel externo (Yaarsa) para mensagens que o
 * cliente entende, em vez de mostrar o erro cru.
 */
export type PanelErrorInfo = {
  code: string | null;
  title: string;
  hint: string;
  /** true = o cliente deve abrir chamado no suporte */
  support: boolean;
};

const MAP: Record<string, Omit<PanelErrorInfo, "code">> = {
  "803": {
    title: "Erro 803 — sessão recusada pelo painel",
    hint:
      "Esse código aparece quando o login está preso em outra sessão ou o servidor recusou a autenticação. " +
      "Use o botão \"Tem algum erro?\" na sua licença: nós reaplicamos suas credenciais no servidor e o acesso volta em poucos minutos.",
    support: true,
  },
  "801": {
    title: "Erro 801 — credenciais não aceitas",
    hint: "Confira se copiou usuário e senha exatamente do painel. Se estiver certo, acione o suporte pela licença.",
    support: true,
  },
  "802": {
    title: "Erro 802 — licença expirada ou suspensa",
    hint: "Renove ou reative a licença no painel. Se acabou de pagar, aguarde 1 minuto e atualize a página.",
    support: false,
  },
};

export function parsePanelErrorCode(raw: unknown): string | null {
  const text = typeof raw === "string" ? raw : (raw as any)?.message ?? "";
  const m = String(text).match(/\b(80[0-9]|8[1-9][0-9])\b/);
  return m ? m[1] : null;
}

export function describePanelError(raw: unknown): PanelErrorInfo | null {
  const code = parsePanelErrorCode(raw);
  if (!code) return null;
  const known = MAP[code];
  if (known) return { code, ...known };
  return {
    code,
    title: `Erro ${code} no painel`,
    hint: "Esse código veio do servidor do painel. Acione o suporte pela sua licença que a gente resolve.",
    support: true,
  };
}

/** Mensagem curta pronta para toast. */
export function friendlyPanelError(raw: unknown, fallback = "Falha na operação"): string {
  const info = describePanelError(raw);
  if (info) return `${info.title}. ${info.hint}`;
  const msg = typeof raw === "string" ? raw : (raw as any)?.message;
  return msg || fallback;
}
