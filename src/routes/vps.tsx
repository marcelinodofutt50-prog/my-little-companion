import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Cpu, HardDrive, MemoryStick, Server, Zap, Layers3, Loader2, MonitorCog, ShieldCheck, Clock, Headphones } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { createMarketCheckout } from "@/lib/market.functions";

export const Route = createFileRoute("/vps")({
  head: () => ({
    meta: [
      { title: "VPS Shadow — Servidores a partir de R$ 180/mês" },
      { name: "description", content: "VPS Starter, Performance e Pro com GPU RTX. Pagamento por Pix ou cartão no Mercado Pago, entrega pela equipe Shadow." },
      { property: "og:title", content: "VPS Shadow — Servidores a partir de R$ 180/mês" },
      { property: "og:description", content: "Escolha sua VPS: i7, Ryzen 3 ou Ryzen 7 + RTX 5050. Planos mensais com pagamento pelo Mercado Pago." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VpsStorefrontPage,
});

const plans = [
  {
    slug: "vps-starter",
    name: "VPS Starter",
    label: "Para começar",
    price: 180,
    icon: Server,
    specs: [
      { icon: Cpu, text: "Intel i7 3ª geração" },
      { icon: MemoryStick, text: "4 GB RAM DDR3" },
      { icon: HardDrive, text: "120 GB SSD" },
    ],
  },
  {
    slug: "vps-performance",
    name: "VPS Performance",
    label: "Mais vendido",
    price: 325,
    icon: Zap,
    featured: true,
    specs: [
      { icon: Cpu, text: "AMD Ryzen 3 3200" },
      { icon: MemoryStick, text: "8 GB RAM DDR4" },
      { icon: HardDrive, text: "512 GB SSD NVMe" },
    ],
  },
  {
    slug: "vps-pro",
    name: "VPS Pro GPU",
    label: "Máxima potência",
    price: 512,
    icon: Layers3,
    specs: [
      { icon: Cpu, text: "AMD Ryzen 7 5700X" },
      { icon: MonitorCog, text: "RTX GeForce 5050" },
      { icon: MemoryStick, text: "32 GB RAM DDR4" },
      { icon: HardDrive, text: "2 TB de armazenamento" },
    ],
  },
];

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function VpsStorefrontPage() {
  const navigate = useNavigate();
  const checkout = useServerFn(createMarketCheckout);
  const [buying, setBuying] = useState<string | null>(null);

  const buy = async (slug: string) => {
    setBuying(slug);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        toast.info("Entre na sua conta para comprar a VPS.");
        navigate({ to: "/auth" });
        return;
      }
      const r = await checkout({ data: { slug, returnOrigin: window.location.origin } });
      window.location.href = r.checkoutUrl;
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível iniciar o pagamento.");
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.12),transparent_55%)]" />
          <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-primary">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Vendas abertas
            </div>
            <h1 className="max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">
              Sua própria <span className="text-primary">VPS</span>, pronta para rodar.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Servidores dedicados com pagamento mensal por Pix ou cartão no Mercado Pago. A equipe Shadow entrega o acesso e acompanha pelo suporte.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#planos" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:opacity-90">
                Ver planos <ArrowRight className="h-4 w-4" />
              </a>
              <Link to="/planos" className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 font-semibold transition hover:bg-muted">
                Licenças Shadow
              </Link>
            </div>
          </div>
        </section>

        <section id="planos" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="mb-10 max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">Planos VPS</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Escolha a potência do seu projeto</h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {plans.map((p) => {
              const Icon = p.icon;
              return (
                <article key={p.slug} className={`relative flex h-full flex-col rounded-2xl border p-6 transition hover:-translate-y-1 sm:p-7 ${p.featured ? "border-primary/60 bg-primary/[0.06] shadow-lg shadow-primary/10" : "border-border bg-card hover:border-primary/40"}`}>
                  {p.featured && <span className="absolute right-5 top-5 rounded-full bg-primary/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-primary">Mais vendido</span>}
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{p.label}</p>
                  <h3 className="mt-2 text-2xl font-bold">{p.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-black">{brl(p.price)}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                  <div className="my-6 h-px bg-border" />
                  <ul className="space-y-3">
                    {p.specs.map((s) => (
                      <li key={s.text} className="flex items-center gap-2.5 text-sm">
                        <s.icon className="h-4 w-4 shrink-0 text-primary" />
                        <span>{s.text}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-7">
                    <button
                      onClick={() => buy(p.slug)}
                      disabled={buying !== null}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 font-semibold transition disabled:opacity-60 ${p.featured ? "bg-primary text-primary-foreground hover:opacity-90" : "border border-primary/50 text-primary hover:bg-primary/10"}`}
                    >
                      {buying === p.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Contratar · {brl(p.price)}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, t: "Pagamento seguro", d: "Pix ou cartão pelo Mercado Pago." },
              { icon: Clock, t: "Entrega rápida", d: "A equipe libera o acesso após a confirmação." },
              { icon: Headphones, t: "Suporte Shadow", d: "Acompanhamento direto pelo chat do suporte." },
            ].map((b) => (
              <div key={b.t} className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-5">
                <b.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h3 className="font-semibold">{b.t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{b.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
