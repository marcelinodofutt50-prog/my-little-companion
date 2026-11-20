import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, Monitor, Layers3, ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { siteUrl } from "@/lib/site-url";

export const Route = createFileRoute("/gangstar-remote")({
  head: () => ({
    meta: [
      { title: "Gangstar Remote — Software para PC" },
      { name: "description", content: "Conheça o Gangstar Remote e seus planos mensais." },
    ],
    links: [{ rel: "canonical", href: siteUrl("/gangstar-remote") }],
  }),
  component: GangstarRemotePage,
});

function GangstarRemotePage() {
  return (
    <div className="min-h-screen bg-[#08090e] text-white">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_72%_20%,rgba(79,70,229,0.25),transparent_50%),radial-gradient(ellipse_at_15%_85%,rgba(8,145,178,0.12),transparent_42%)]" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-size-[48px_48px]" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-indigo-200">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Software para PC
              </span>
              <h1 className="mt-6 font-display text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">Gangstar <span className="text-indigo-300">Remote</span></h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-slate-300 sm:text-lg">Conheça o Gangstar Remote e escolha o plano mensal que combina com você.</p>
              <a href="#planos" className="mt-9 inline-flex items-center gap-3 rounded-lg bg-indigo-500 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300">Ver planos <ArrowDown className="h-4 w-4" aria-hidden="true" /></a>
            </div>
            <div aria-hidden="true" className="rounded-2xl border border-white/10 bg-[#0e101b]/90 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.4)] sm:p-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-400" /><span className="h-2 w-2 rounded-full bg-slate-600" /><span className="h-2 w-2 rounded-full bg-slate-600" /></div><span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">Gangstar Remote</span></div>
              <div className="grid min-h-64 place-items-center rounded-xl bg-[radial-gradient(circle,rgba(99,102,241,0.2),transparent_65%)] py-12"><div className="text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-indigo-400/25 bg-indigo-500/10"><Monitor className="h-9 w-9 text-indigo-300" /></div><p className="mt-5 font-mono text-xs uppercase tracking-[0.25em] text-slate-300">Gangstar Remote</p><p className="mt-2 text-sm text-slate-500">Software para PC</p></div></div>
            </div>
          </div>
        </section>
        <section id="planos" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-24">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-indigo-300"><Layers3 className="h-4 w-4" aria-hidden="true" /> Assinatura mensal</div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Escolha seu plano</h2>
          <p className="mt-3 max-w-xl leading-7 text-slate-400">Os planos e valores do Gangstar Remote serão disponibilizados em breve.</p>
          <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div><h3 className="font-semibold">Planos em preparação</h3><p className="mt-2 text-sm leading-6 text-slate-400">As opções de assinatura e o acesso ao checkout aparecerão aqui quando estiverem disponíveis.</p></div>
            <span className="inline-flex shrink-0 items-center gap-2 text-sm text-slate-400">Em breve <ChevronRight className="h-4 w-4" aria-hidden="true" /></span>
          </div>
        </section>
      </main>
    </div>
  );
}

