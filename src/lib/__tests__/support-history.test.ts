import { describe, expect, it } from "vitest";
import {
  initialHistoryButtonState,
  reduceHistoryButton,
} from "../support-history";

describe("reduceHistoryButton", () => {
  it("carga inicial com mais páginas mostra o botão", () => {
    const s = reduceHistoryButton(initialHistoryButtonState, { kind: "initial", serverHasMore: true });
    expect(s.hasMore).toBe(true);
    expect(s.firstLoadDone).toBe(true);
  });

  it("carga inicial sem mais páginas esconde o botão", () => {
    const s = reduceHistoryButton(initialHistoryButtonState, { kind: "initial", serverHasMore: false });
    expect(s.hasMore).toBe(false);
  });

  it("carga de histórico que esgota as mensagens esconde o botão", () => {
    let s = reduceHistoryButton(initialHistoryButtonState, { kind: "initial", serverHasMore: true });
    s = reduceHistoryButton(s, { kind: "history", serverHasMore: false });
    expect(s.hasMore).toBe(false);
  });

  it("refresh da cauda NUNCA reabre o botão depois do histórico esgotado", () => {
    let s = reduceHistoryButton(initialHistoryButtonState, { kind: "initial", serverHasMore: true });
    s = reduceHistoryButton(s, { kind: "history", serverHasMore: false });
    // Reconexão/polling devolvem a cauda com hasMore=true — deve ser ignorado.
    s = reduceHistoryButton(s, { kind: "refresh", serverHasMore: true });
    expect(s.hasMore).toBe(false);
  });

  it("refresh da cauda não esconde o botão enquanto ainda há histórico", () => {
    let s = reduceHistoryButton(initialHistoryButtonState, { kind: "initial", serverHasMore: true });
    s = reduceHistoryButton(s, { kind: "refresh", serverHasMore: false });
    expect(s.hasMore).toBe(true);
  });

  it("segunda carga inicial (mesma conversa) não sobrescreve o estado", () => {
    let s = reduceHistoryButton(initialHistoryButtonState, { kind: "initial", serverHasMore: true });
    s = reduceHistoryButton(s, { kind: "history", serverHasMore: false });
    s = reduceHistoryButton(s, { kind: "initial", serverHasMore: true });
    expect(s.hasMore).toBe(false);
  });
});
