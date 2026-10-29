export type WinnerRow = { id: string; giveaway_title: string; nickname: string; prize_label: string; awarded_on: string; created_at: string };

/** Agrupa os vencedores por sorteio; dentro de cada sorteio, na ordem em que o admin cadastrou. */
export function groupWinnersByGiveaway(rows: WinnerRow[]) {
  const groups = new Map<string, WinnerRow[]>();
  for (const row of rows) {
    const list = groups.get(row.giveaway_title) ?? [];
    list.push(row);
    groups.set(row.giveaway_title, list);
  }
  return [...groups.entries()]
    .map(([title, winners]) => ({
      title,
      winners: [...winners].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      latest: winners.reduce((m, w) => (w.awarded_on > m ? w.awarded_on : m), ""),
    }))
    .sort((a, b) => b.latest.localeCompare(a.latest));
}
