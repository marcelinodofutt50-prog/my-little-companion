import { createFileRoute } from "@tanstack/react-router";
import { Gift, Trophy } from "lucide-react";
import { WinnersGrid } from "@/components/GiveawayWinnersCard";
import { groupWinnersByGiveaway } from "@/lib/winner-groups";
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
        {groupWinnersByGiveaway(winners).map((g) => (
          <section key={g.title} className="terminal-card space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-bold uppercase"><Gift className="h-5 w-5 text-primary" /> {g.title}</h2>
              <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDay(g.latest)}</span>
            </div>
            <WinnersGrid winners={g.winners} />
          </section>
        ))}
      </main>
    </div>
  );
}
