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
        <header className="relative isolate flex min-h-72 items-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 px-6 py-16 text-white sm:min-h-96 sm:px-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_18%_20%,#312e81_0%,transparent_58%),radial-gradient(ellipse_at_88%_100%,#155e75_0%,transparent_50%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,#ffffff12_1px,transparent_1px),linear-gradient(to_bottom,#ffffff12_1px,transparent_1px)] bg-size-[32px_32px]"
          />
          <h1 className="max-w-3xl font-display text-4xl leading-none font-black tracking-tighter uppercase italic drop-shadow-[0_0_20px_#67e8f955] sm:text-6xl lg:text-7xl">
            {title}
          </h1>
        </header>
      </main>
    </div>
  );
}
