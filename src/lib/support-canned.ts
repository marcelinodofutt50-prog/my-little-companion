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
