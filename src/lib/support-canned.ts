/**
 * Respostas automáticas determinísticas do suporte (sem IA, sem custo de quota).
 * Cobrem dúvidas recorrentes: treinamento BTmob/login e o "network error" visual.
 */

/** Cliente perguntando como criar o app na BTmob ou como usar o login/painel. */
export function isTrainingQuestion(text: string): boolean {
  const t = (text || "").toLowerCase();
  const asksHow = /(como|onde|ensina|tutorial|passo\s*a\s*passo|aprender|consigo|faço|faco|fazer)/.test(t);
  const topic =
    /(criar|cria|gerar|gera|montar|fazer|faz)[^.!?]{0,40}(aplicativo|app|apk|btmob)/.test(t) ||
    /\bbtmob\b[^.!?]{0,40}(criar|cria|app|aplicativo|apk)/.test(t) ||
    /(usar|uso|usa|utilizar|utiliza|utilizo|mexer|funciona)[^.!?]{0,30}(login|painel|licen[çc]a|app|apk|btmob)/.test(t) ||
    /(login|painel|licen[çc]a)[^.!?]{0,30}(usar|usa|funciona|entrar|acessar)/.test(t);
  return asksHow && topic;
}

/**
 * Cliente reclamando de "network error" / "erro de internet" — é um aviso
 * puramente visual do app, não interfere no funcionamento.
 */
export function isVisualNetworkError(text: string): boolean {
  const t = (text || "").toLowerCase();
  return (
    /network\s*error/.test(t) ||
    /erro(r)?\s+(de\s+)?(internet|rede|conex[ãa]o)/.test(t) ||
    /(internet|rede|conex[ãa]o)[^.!?]{0,20}erro/.test(t)
  );
}

export function buildTrainingReply(): string {
  return [
    "Verifiquei aqui: para aprender a criar o aplicativo na BTmob e usar o login, é só seguir nossa **Central de Treinamento**. 🎧",
    "",
    "1. Abra a aba **Treinamento** aqui no painel.",
    "2. Escolha o guia do que você quer fazer (criar app, login, licença...).",
    "3. Siga os passos **direitinho, na ordem** — pulou etapa, dá erro.",
    "",
    "Qual passo você está agora? Me fala que eu te destravo. ⚡",
  ].join("\n");
}

export function buildVisualErrorReply(): string {
  return [
    "Verifiquei: esse **\"network error\" / erro de internet é apenas visual** — um aviso do app que não interfere em nada no funcionamento. ✅",
    "",
    "Pode ignorar e usar normalmente: login, painel e licença seguem 100%.",
    "",
    "Apareceu algum outro erro além desse? 🛡️",
  ].join("\n");
}

/* ------------------------------------------------------------------ *
 * Verificação de login com PIN de segurança
 * ------------------------------------------------------------------ */

/** Marcador invisível ao cliente que identifica o pedido de PIN já enviado. */
/* Caracteres invisíveis: identificam a mensagem sem poluir o chat. */
export const PIN_REQUEST_MARKER = "\u200b\u2060\u200b";

/** Cliente relatando problema de login/acesso ao painel ou à licença. */
export function isLoginAccessIssue(text: string): boolean {
  const t = (text || "").toLowerCase();
  if (isTrainingQuestion(t)) return false;
  const problem =
    /(n[ãa]o|nao|sem)\s+(consigo|consegue|to|tô|estou|est[aá]|d[aá]|deu)/.test(t) ||
    /(erro|invalid|inv[áa]lid|expirou|venceu|vencid|bloque|negad|problema|bug|falha|n[ãa]o funciona|nao funciona)/.test(t);
  const topic =
    /(login|logar|entrar|acessar|acesso|senha|conta|usu[áa]rio|painel|licen[çc]a|btmob|yaarsa)/.test(t);
  return problem && topic;
}

/** Extrai um PIN no formato ABCD-2345 (ou 8 caracteres colados) da mensagem. */
export function extractPin(text: string): string | null {
  const t = (text || "").toUpperCase();
  const m = t.match(/\b([A-Z0-9]{4})[-\s]?([A-Z0-9]{4})\b/);
  if (!m) return null;
  const pin = `${m[1]}${m[2]}`;
  if (!/[A-Z]/.test(pin) && !/[0-9]/.test(pin)) return null;
  return pin;
}

export function buildPinRequest(): string {
  return [
    `${PIN_REQUEST_MARKER}Quer que nossa equipe **verifique o seu login** agora? 🛡️`,
    "",
    "1. Abra o **Shadow Pass** (ou o cantinho aqui do chat) e copie seu **PIN de segurança**.",
    "2. Envie o PIN aqui nesta conversa.",
    "3. Assim que recebermos, o PIN é **queimado na hora** e um novo é gerado pra você.",
    "",
    "Só com o PIN a equipe consegue ver os dados do seu acesso e continuar o reparo. Pode enviar? ⚡",
  ].join("\n");
}

export function buildPinAcceptedReply(): string {
  return [
    "PIN confirmado ✅ Já **revoguei esse PIN** e gerei um novo pra você no Shadow Pass.",
    "",
    "A equipe está liberada para conferir os dados do seu login e seguir com o reparo.",
    "",
    "Fica aqui um instante que já te retorno. 🎧",
  ].join("\n");
}

export function buildPinRejectedReply(): string {
  return [
    "Esse PIN não confere ou já foi usado (ele muda a cada consulta). 🛡️",
    "",
    "1. Abra o **Shadow Pass** ou o cantinho do chat.",
    "2. Toque em **Mostrar** e copie o PIN atual.",
    "3. Envie ele aqui de novo.",
  ].join("\n");
}
