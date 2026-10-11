import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Cpu, HardDrive, ShieldCheck, Server, Zap, Layers3 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/vps")({
  head: () => ({
    meta: [
      { title: "VPS Shadow — Servidores dedicados em preparação" },
      { name: "description", content: "Conheça as categorias de VPS da ShadowDash: Starter, Performance e Pro. Infraestrutura em preparação, com vendas liberadas em breve." },
      { property: "og:title", content: "VPS Shadow — Servidores dedicados em preparação" },
      { property: "og:description", content: "Categorias de VPS da ShadowDash: Starter, Performance e Pro. Vendas em breve." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VpsStorefrontPage,
});

const categories = [
  {
    name: "VPS Starter",
    label: "Projetos pequenos",
    description: "Para sites leves, ambientes de teste e aplicações pessoais.",
    specs: ["Recursos essenciais", "Acesso administrativo", "Escalabilidade futura"],
    icon: Server,
  },
  {
    name: "VPS Performance",
    label: "Bots e aplicações",
    description: "Para aplicações contínuas, bots e serviços que precisam de mais folga.",
    specs: ["Mais CPU e memória", "Armazenamento ampliado", "Uso contínuo"],
    icon: Zap,
    featured: true,
  },
  {
    name: "VPS Pro",
    label: "Projetos exigentes",
    description: "Uma categoria planejada para cargas maiores e projetos em crescimento.",
    specs: ["Recursos avançados", "Mais capacidade de armazenamento", "Opções de expansão"],
    icon: Layers3,
  },
];

function VpsStorefrontPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.10),transparent_55%)]" />
          <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Nova categoria · em preparação
            </div>
            <h1 className="max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">
              Sua próxima ideia merece um <span className="text-emerald-400">servidor próprio.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Conheça as categorias planejadas de VPS da ShadowDash. Estamos preparando a infraestrutura e a integração de entrega antes de liberar as compras.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#categorias" className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400">
                Explorar categorias <ArrowRight className="h-4 w-4" />
              </a>
              <Link to="/planos" className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 font-semibold transition hover:bg-muted">
                Ver outros planos
              </Link>
            </div>
          </div>
        </section>

        <section id="categorias" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="mb-10 max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-emerald-400">Categorias VPS</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Escolha o perfil do seu projeto</h2>
            <p className="mt-4 text-muted-foreground">Estas categorias são uma proposta inicial. As configurações exatas, preços, disponibilidade e localização dos servidores serão publicados após a escolha do provedor.</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <article key={category.name} className={`relative flex h-full flex-col rounded-2xl border p-6 sm:p-7 ${category.featured ? "border-emerald-500/50 bg-emerald-500/[0.06] shadow-lg shadow-emerald-950/20" : "border-border bg-card"}`}>
                  {category.featured && <span className="absolute right-5 top-5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-emerald-400">Em destaque</span>}
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{category.label}</p>
                  <h3 className="mt-2 text-2xl font-bold">{category.name}</h3>
                  <p className="mt-3 min-h-16 text-sm leading-6 text-muted-foreground">{category.description}</p>
                  <div className="my-6 h-px bg-border" />
                  <ul className="space-y-3">
                    {category.specs.map((spec) => (
                      <li key={spec} className="flex items-start gap-2.5 text-sm">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        <span>{spec}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-7">
                    <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-background/70 px-3 py-3 text-xs text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Vendas ainda não disponíveis
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-8 rounded-xl border border-border/70 bg-card/60 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Cpu className="mt-1 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <h3 className="font-semibold">Configurações transparentes</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Não exibimos preços ou especificações técnicas como se já estivessem confirmados. Assim que o provedor e os recursos forem definidos, esta página poderá mostrar CPU, RAM, SSD, tráfego, localização, preço e condições de entrega reais.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
