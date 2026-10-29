import { describe, expect, it } from "vitest";
import { groupWinnersByGiveaway, type WinnerRow } from "@/lib/winner-groups";

const row = (id: string, title: string, created: string, day = "2026-10-29"): WinnerRow =>
  ({ id, giveaway_title: title, nickname: id, prize_label: "Licença Mensal", awarded_on: day, created_at: created });

describe("groupWinnersByGiveaway", () => {
  it("cria um card por sorteio, mantendo a ordem de cadastro dentro dele", () => {
    const groups = groupWinnersByGiveaway([row("b", "Sorteio 1K", "2026-10-29T10:02"), row("a", "Sorteio 1K", "2026-10-29T10:01"), row("c", "Sorteio 2K", "2026-11-01T10:00", "2026-11-01")]);
    expect(groups.map((g) => g.title)).toEqual(["Sorteio 2K", "Sorteio 1K"]);
    expect(groups[1].winners.map((w) => w.id)).toEqual(["a", "b"]);
  });
});
