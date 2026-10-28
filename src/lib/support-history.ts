/**
 * Controle do botão "Carregar histórico" do chat de suporte.
 *
 * Regra: só a carga inicial e as cargas de histórico (cursor `before`) podem
 * mudar o estado do botão. Atualizações da cauda (reconexão, polling de
 * "visto", aba voltando) NUNCA reabrem o botão depois que o histórico acabou —
 * antes disso, o usuário clicava, nada carregava e parecia bug.
 */
export type HistoryButtonState = {
  /** Se a primeira carga da conversa já aconteceu. */
  firstLoadDone: boolean;
  /** Se ainda existem mensagens mais antigas para buscar. */
  hasMore: boolean;
};

export const initialHistoryButtonState: HistoryButtonState = {
  firstLoadDone: false,
  hasMore: false,
};

export type HistoryLoadEvent = {
  /** initial = primeira carga da conversa; history = carga com cursor; refresh = recarga da cauda. */
  kind: "initial" | "history" | "refresh";
  /** Valor de hasMore devolvido pelo servidor nesta resposta. */
  serverHasMore: boolean;
};

export function reduceHistoryButton(
  state: HistoryButtonState,
  evt: HistoryLoadEvent,
): HistoryButtonState {
  if (evt.kind === "history") {
    return { firstLoadDone: true, hasMore: evt.serverHasMore };
  }
  if (evt.kind === "initial" && !state.firstLoadDone) {
    return { firstLoadDone: true, hasMore: evt.serverHasMore };
  }
  // Refresh da cauda: mantém o estado — nunca reabre nem fecha o botão.
  return state;
}
