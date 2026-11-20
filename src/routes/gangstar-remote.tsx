import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { siteUrl } from "@/lib/site-url";

const title = "Gangstar Remote 4.5";

export const Route = createFileRoute("/gangstar-remote")({
  head: () => ({
    meta: [{ title: `${title} — Shadow` }],
    links: [{ rel: "canonical", href: siteUrl("/gangstar-remote") }],
  }),
  component: GangstarRemotePage,
});

function GangstarRemotePage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="rounded-2xl border border-white/10 bg-zinc-950 px-6 py-20 text-center text-white sm:px-12 sm:py-28">
          <h1 className="font-display text-4xl font-black uppercase italic tracking-tighter sm:text-6xl">
            {title}
          </h1>
        </header>
      </main>
    </div>
  );
}
