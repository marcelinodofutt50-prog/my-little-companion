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
        <header className="overflow-hidden rounded-2xl border border-slate-700">
          <h1 className="sr-only">{title}</h1>
          <img
            src="/images/gangstar-remote.webp"
            alt="Gangstar Remote 4.5 — Nubank e Itaú"
            width={1672}
            height={941}
            className="block h-auto w-full"
          />
        </header>
      </main>
    </div>
  );
}
