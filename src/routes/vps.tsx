import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Cpu, HardDrive, MemoryStick, Server, Zap, Layers3, Loader2, MonitorCog, ShieldCheck, Clock, Headphones } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { createMarketCheckout } from "@/lib/market.functions";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useMoney, UsdNotice } from "@/lib/currency";
// Imagens servidas de public/assets para funcionar tanto no preview quanto no site publicado (Vercel).
const gamerExampleUrl = "/assets/vps-gamer-example.png";
const performanceImage = "/assets/vps-performance.jpg";
const enterpriseImage = "/assets/vps-enterprise.jpg";

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
    label: "Para começar", labelEn: "Getting started",
    image: gamerExampleUrl,
    description: "Seu ambiente de trabalho remoto, sem manter a BTmob no desktop pessoal. Separe sua operação do computador do dia a dia.",
    descriptionEn: "Your remote workspace, without keeping BTmob on your personal computer. Keep your operation separate from your everyday PC.",
    price: 180,
    icon: Server,
    specs: [
      { icon: Cpu, text: "Intel i7 3ª geração", textEn: "3rd-gen Intel i7" },
      { icon: MemoryStick, text: "4 GB RAM DDR3" },
      { icon: HardDrive, text: "120 GB SSD" },
    ],
  },
  {
    slug: "vps-performance",
    name: "VPS Performance",
    label: "Seu próprio servidor", labelEn: "Your own server",
    image: performanceImage,
    description: "Para colocar seu próprio servidor no ar: hospede a BTmob ou outros serviços em um ambiente dedicado à sua operação.",
    descriptionEn: "Run your own server: host BTmob or other services in an environment dedicated to your operation.",
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
    label: "Máxima potência", labelEn: "Maximum power",
    image: enterpriseImage,
    description: "Para operações empresariais com infraestrutura própria e vários clientes. Mais memória, armazenamento e processamento gráfico.",
    descriptionEn: "For business operations with their own infrastructure and many clients. More memory, storage and graphics power.",
    price: 512,
    icon: Layers3,
    specs: [
      { icon: Cpu, text: "AMD Ryzen 7 5700X" },
      { icon: MonitorCog, text: "RTX GeForce 5050" },
      { icon: MemoryStick, text: "32 GB RAM DDR4" },
      { icon: HardDrive, text: "2 TB de armazenamento", textEn: "2 TB storage" },
    ],
  },
];


function VpsStorefrontPage() {
  const navigate = useNavigate();
  const { lang } = useI18n();
  const en = lang === "en";
  const tr = (pt: string, e: string) => (en ? e : pt);
  const { fmt: brl } = useMoney();
  const checkout = useServerFn(createMarketCheckout);
  const [buying, setBuying] = useState<string | null>(null);

  const buy = async (slug: string) => {
    setBuying(slug);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        toast.info(tr("Entre na sua conta para comprar a VPS.", "Sign in to buy a VPS."));
        navigate({ to: "/auth" });
        return;
      }
      const r = await checkout({ data: { slug, returnOrigin: window.location.origin } });
      window.location.href = r.checkoutUrl;
    } catch (e: any) {
      toast.error(e?.message || tr("Não foi possível iniciar o pagamento.", "Could not start the payment."));
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <img src={enterpriseImage} alt={tr("Estação de trabalho de alto desempenho ilustrativa", "Illustrative high-performance workstation")} width={1024} height={768} className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-background/80" />
          <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-primary">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              {tr("Vendas abertas", "Now available")}
            </div>
            <h1 className="max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">
              VPS <span className="text-primary">Shadow</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              {tr("Do seu trabalho remoto à sua própria infraestrutura. Escolha a configuração e pague mensalmente por Pix ou cartão no Mercado Pago.", "From remote work to your own infrastructure. Pick a configuration and pay monthly by Pix or card via Mercado Pago.")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><a href="#planos">
                {tr("Ver planos", "See plans")} <ArrowRight className="h-4 w-4" />
              </a></Button>
              <Button asChild size="lg" variant="outline"><Link to="/planos">
                {tr("Licenças Shadow", "Shadow licenses")}
              </Link></Button>
            </div>
          </div>
        </section>

        <section id="planos" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="mb-10 max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">{tr("Planos VPS", "VPS plans")}</p>
            <UsdNotice className="mb-2" />
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{tr("Escolha a potência do seu projeto", "Choose the power your project needs")}</h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {plans.map((p) => {
              const Icon = p.icon;
              return (
                <article key={p.slug} className={`relative flex h-full flex-col overflow-hidden rounded-lg border transition motion-safe:hover:-translate-y-1 ${p.featured ? "border-primary/60 bg-primary/[0.06] shadow-lg shadow-primary/10" : "border-border bg-card hover:border-primary/40"}`}>
                  <img src={p.image} alt={en ? `Illustrative computer for ${p.name}` : `Computador ilustrativo do ${p.name}`} loading="lazy" width={1024} height={768} className="aspect-[4/3] w-full border-b border-border object-contain bg-muted" />
                  <div className="flex flex-1 flex-col p-6 sm:p-7">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{en ? p.labelEn : p.label}</p>
                  <h3 className="mt-2 text-2xl font-bold">{p.name}</h3>
                  <p className="mt-3 min-h-24 text-sm leading-6 text-muted-foreground">{en ? p.descriptionEn : p.description}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-black">{brl(p.price)}</span>
                    <span className="text-sm text-muted-foreground">{tr("/mês", "/month")}</span>
                  </div>
                  <div className="my-6 h-px bg-border" />
                  <ul className="space-y-3">
                    {p.specs.map((s) => (
                      <li key={s.text} className="flex items-center gap-2.5 text-sm">
                        <s.icon className="h-4 w-4 shrink-0 text-primary" />
                        <span>{en && "textEn" in s && s.textEn ? s.textEn : s.text}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-7">
                    <Button
                      onClick={() => buy(p.slug)}
                      disabled={buying !== null}
                      variant={p.featured ? "default" : "outline"}
                      className="h-12 w-full"
                    >
                      {buying === p.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {tr("Contratar", "Order")} · {brl(p.price)}
                    </Button>
                  </div>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{tr("Imagens ilustrativas. A configuração contratada é a descrita em cada plano; o gabinete e a aparência podem variar.", "Images are illustrative. You get the configuration listed in each plan; case and appearance may vary.")}</p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, t: tr("Pagamento seguro", "Secure payment"), d: tr("Pix ou cartão pelo Mercado Pago.", "Pix or card via Mercado Pago.") },
              { icon: Clock, t: tr("Atendimento após o pagamento", "Service after payment"), d: tr("Pagamento confirmado: um chamado é aberto para a equipe preparar seu acesso.", "Once payment is confirmed, a ticket opens so the team can prepare your access.") },
              { icon: Headphones, t: tr("Suporte Shadow", "Shadow support"), d: tr("Acompanhamento direto pelo chat do suporte.", "Direct follow-up through support chat.") },
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
