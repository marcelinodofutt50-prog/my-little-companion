import { describe, expect, it } from "vitest";
import {
  WEEKEND_NOTICE_MARKER,
  buildWeekendNotice,
  isWeekendInSaoPaulo,
  saoPauloDayKey,
} from "@/lib/support-canned";

describe("aviso de fim de semana no suporte", () => {
  it("reconhece sábado e domingo no horário de Brasília", () => {
    expect(isWeekendInSaoPaulo(new Date("2026-02-07T15:00:00Z"))).toBe(true); // sábado
    expect(isWeekendInSaoPaulo(new Date("2026-02-08T15:00:00Z"))).toBe(true); // domingo
    expect(isWeekendInSaoPaulo(new Date("2026-02-09T15:00:00Z"))).toBe(false); // segunda
  });

  it("respeita o fuso: domingo 23h em Brasília ainda é fim de semana", () => {
    expect(isWeekendInSaoPaulo(new Date("2026-02-09T02:00:00Z"))).toBe(true);
  });

  it("gera o aviso com marcador do dia e sem horário fixo", () => {
    const now = new Date("2026-02-07T15:00:00Z");
    const msg = buildWeekendNotice(now);
    expect(msg).toContain(`${WEEKEND_NOTICE_MARKER}${saoPauloDayKey(now)}`);
    expect(msg.toLowerCase()).toContain("não tem horário fixo");
  });

  it("marcador muda de um dia para o outro", () => {
    expect(saoPauloDayKey(new Date("2026-02-07T15:00:00Z"))).not.toBe(
      saoPauloDayKey(new Date("2026-02-08T15:00:00Z")),
    );
  });
});
