import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { siteUrl } from "@/lib/site-url";
import { listPublicWinners } from "@/lib/winner-board.functions";

export const Route = createFileRoute("/vencedores")({
  loader: () => listPublicWinners(),
  head: () => ({
    meta: [
      { title: "Vencedores dos sorteios — Shadow" },
      { name: "description", content: "Veja os apelidos dos vencedores dos sorteios da comunidade Shadow." },
      { property: "og:title", content: "Vencedores dos sorteios — Shadow" },
      { property: "og:description", content: "Apelidos dos vencedores dos sorteios da comunidade Shadow." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/vencedores") },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: siteUrl("/vencedores") }],
  }),
  component: WinnersPage,
});

function formatDay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function WinnersPage() {
  const { winners, error } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-primary"><Trophy className="h-6 w-6" /><h1 className="text-3xl font-bold text-foreground">Vencedores dos sorteios</h1></div>
          <p className="text-sm text-muted-foreground">Mostramos apenas o apelido de cada vencedor.</p>
        </header>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!error && winners.length === 0 && <p className="terminal-card p-6 text-center text-sm text-muted-foreground">Os vencedores aparecem aqui assim que forem registrados.</p>}
        {winners.length > 0 && (
          <div className="terminal-card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="p-3">Apelido</th><th className="p-3">Sorteio</th><th className="p-3">Prêmio</th><th className="p-3">Data</th></tr>
              </thead>
              <tbody>
                {winners.map((w) => (
                  <tr key={w.id} className="border-b border-border/50 last:border-0">
                    <td className="p-3 font-semibold text-primary">{w.nickname}</td>
                    <td className="p-3">{w.giveaway_title}</td>
                    <td className="p-3">{w.prize_label}</td>
                    <td className="whitespace-nowrap p-3 text-muted-foreground">{formatDay(w.awarded_on)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
