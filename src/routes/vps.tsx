import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Cpu, HardDrive, MemoryStick, Server, ShieldCheck, Zap } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/vps")({
  component: VpsStorefrontPage,
});

const plans = [
  {
    name: "VPS Starter",
    eyebrow: "Para começar",
    description: "Uma opção de entrada para projetos leves e ambientes de teste.",
    cpu: "Intel Core i7 — 3ª geração",
    ram: "4 GB DDR3",
    storage: "120 GB SSD",
    price: 180,
    icon: Server,
    featured: false,
  },
  {
    name: "VPS Performance",
    eyebrow: "Equilíbrio para apps",
    description: "Mais memória e armazenamento rápido para aplicações e serviços contínuos.",
    cpu: "AMD Ryzen 3 3200",
    ram: "8 GB DDR4",
    storage: "512 GB SSD NVMe",
    price: 325,
    icon: Zap,
    featured: true,
  },
  {
    name: "VPS Pro",
    eyebrow: "Projetos exigentes",
    description: "Configuração de maior capacidade para cargas de trabalho mais intensas.",
    cpu: "AMD Ryzen 7 5700X",
    ram: "32 GB DDR4",
    storage: "2 TB de armazenamento",
    gpu: "NVIDIA GeForce RTX 5050",
    price: 512,
    icon: ShieldCheck,
    featured: false,
  },
];

const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);

function VpsStorefrontPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="relative isolate overflow-hidden border-b border-border/60">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.18),transparent_55%)]" />
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Linha VPS Shadow
              </div>
              <h1 className="max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">
                Seu projeto. Seus recursos.{" "}
                <span className="text-emerald-400">Seu servidor.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Compare as configurações e escolha o perfil que combina com seu projeto. Os valores abaixo são mensais e em reais.
              </p>
              <a
                href="#planos-vps"
                className="mt-8 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
              >
                Ver planos <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-card/80 p-6 shadow-2xl shadow-emerald-950/10 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Compare antes de escolher</p>
                  <p className="text-sm text-muted-foreground">CPU, memória e armazenamento</p>
                </div>
              </div>
              <div className="my-5 h-px bg-border" />
              <p className="text-sm leading-6 text-muted-foreground">
                A disponibilidade efetiva, a modalidade de virtualização, a largura de banda, os backups e o prazo de ativação precisam ser confirmados antes da abertura das vendas.
              </p>
            </div>
          </div>
        </section>

        <section id="planos-vps" className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="mb-10 max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-emerald-400">Planos mensais</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Escolha sua VPS</h2>
            <p className="mt-4 text-muted-foreground">
              Especificações e preços informados para a linha proposta. Confirme a disponibilidade e os termos do serviço antes de contratar.
            </p>
          </div>

          <div className="grid items-stretch gap-5 lg:grid-cols-3">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <article
                  key={plan.name}
                  className={`relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 transition duration-200 hover:-translate-y-1 hover:shadow-xl sm:p-7 ${plan.featured ? "border-emerald-500/60 bg-emerald-500/[0.06] shadow-lg shadow-emerald-950/20" : "border-border bg-card"}`}
                >
                  {plan.featured && (
                    <span className="absolute right-4 top-4 rounded-full bg-emerald-500/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                      Recomendado
                    </span>
                  )}
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{plan.eyebrow}</p>
                  <h3 className="mt-2 text-2xl font-bold">{plan.name}</h3>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">{plan.description}</p>

                  <div className="my-6 rounded-xl border border-border/70 bg-background/70 p-4">
                    <p className="text-sm text-muted-foreground">Por mês</p>
                    <p className="mt-1 text-3xl font-black tracking-tight">{brl(plan.price)}<span className="ml-1 text-sm font-normal text-muted-foreground">/mês</span></p>
                  </div>

                  <ul className="mb-7 space-y-4">
                    <li className="flex items-start gap-3 text-sm">
                      <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span><span className="block text-xs text-muted-foreground">Processador</span><span className="font-medium">{plan.cpu}</span></span>
                    </li>
                    <li className="flex items-start gap-3 text-sm">
                      <MemoryStick className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span><span className="block text-xs text-muted-foreground">Memória RAM</span><span className="font-medium">{plan.ram}</span></span>
                    </li>
                    <li className="flex items-start gap-3 text-sm">
                      <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span><span className="block text-xs text-muted-foreground">Armazenamento</span><span className="font-medium">{plan.storage}</span></span>
                    </li>
                    {plan.gpu && (
                      <li className="flex items-start gap-3 text-sm">
                        <Zap className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        <span><span className="block text-xs text-muted-foreground">Placa de vídeo</span><span className="font-medium">{plan.gpu}</span></span>
                      </li>
                    )}
                    <li className="flex items-start gap-3 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>Preço mensal exibido de forma transparente</span>
                    </li>
                  </ul>

                  <div className="mt-auto">
                    <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-3 text-xs text-muted-foreground">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                      <span>Contratação ainda não habilitada</span>
                    </div>
                    <Link
                      to="/contato"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      Consultar disponibilidade <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="mt-8 text-xs leading-5 text-muted-foreground">
            Observação: os preços e componentes são os informados para esta proposta. A contratação só deve ser liberada depois da validação da infraestrutura, da capacidade disponível, das condições comerciais e da integração de pagamento e provisionamento.
          </p>
        </section>
      </main>
    </div>
  );
}
