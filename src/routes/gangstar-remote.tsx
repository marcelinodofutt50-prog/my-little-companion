import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Radio, ShieldCheck, Cpu, Fingerprint, SatelliteDish,
  Terminal, Zap, ArrowRight, CheckCircle2, Lock, Headset,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { siteUrl } from "@/lib/site-url";

const title = "Gangstar Remote 4.5";

export const Route = createFileRoute("/gangstar-remote")({
  head: () => ({
    meta: [
      { title: `${title} — Shadow` },
      { name: "description", content: "Gangstar Remote 4.5 — unidade remota da Shadow: injeção estável, bypass de verdade e controle total pelo painel. Status ao vivo e ativação rápida." },
      { property: "og:title", content: `${title} — Shadow` },
      { property: "og:description", content: "Unidade remota 4.5: injeção estável, bypass e controle total pelo painel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: siteUrl("/gangstar-remote") }],
  }),
  component: GangstarRemotePage,
});

// Acento quente da unidade (único ponto de cor fora do azul do site)
const EMBER = "oklch(0.72 0.17 55)";

const FEATURES = [
  { icon: Zap, t: "All Banks", d: "Destrava todos os bancos do mapa e libera dinheiro infinito na sua conta dentro do jogo." },
  { icon: Fingerprint, t: "Encrypter indetectável", d: "Mantém a unidade oculta da detecção pra reduzir o risco de ban enquanto você joga." },
  { icon: ShieldCheck, t: "Bypass nativo", d: "Proteção embutida no núcleo 4.5: segura o acesso sem depender de nada externo." },
  { icon: Radio, t: "Bypass Website", d: "Passa pela verificação de site sem travar a sua entrada na unidade." },
  { icon: Cpu, t: "Funções exclusivas", d: "Recursos que só a Remote 4.5 entrega — além do pacote padrão de mod." },
  { icon: Terminal, t: "Credenciais pelo painel", d: "Seu login aparece direto no painel Shadow, pronto pra usar na hora." },
];

const STEPS = [
  { icon: Lock, t: "Ative a licença", d: "Garante seu acesso pelos planos e a equipe libera a unidade na hora." },
  { icon: Terminal, t: "Conecte ao painel", d: "Abre o painel Shadow, a unidade Remote 4.5 aparece com o status atual." },
  { icon: Zap, t: "Comande e jogue", d: "Dispara os comandos remotos e segue a run com o controle do seu lado." },
];

type RemotePlan = {
  name: string;
  period: string;
  price: string;
  cents: string;
  duration: string;
  note: string;
  perks: string[];
  href: string;
  featured: boolean;
};

const PLANS: RemotePlan[] = [
  {
    name: "Semanal",
    period: "7 dias",
    price: "1.800",
    cents: "",
    duration: "Acesso por 7 dias",
    note: "Pra testar a unidade completa ou operar numa janela curta.",
    perks: [
      "All Banks — dinheiro infinito no jogo",
      "Bypass nativo",
      "Encrypter indetectável",
      "Credenciais pelo painel",
      "Suporte da equipe",
    ],
    href: "https://pay.cakto.com.br/cxwfetz_1350896",
    featured: false,
  },
  {
    name: "Mensal",
    period: "30 dias",
    price: "4.000",
    cents: "",
    duration: "Acesso por 30 dias",
    note: "Melhor valor — a unidade inteira pra quem roda sério todo dia.",
    perks: [
      "Tudo do plano Semanal",
      "Funções exclusivas da Remote 4.5",
      "Bypass Website",
      "Encrypter sempre atualizado",
      "Prioridade no suporte",
      "Status ao vivo no painel",
    ],
    href: "https://pay.cakto.com.br/9mdeqxs_1349153",
    featured: true,
  },
];

function GangstarRemotePage() {
  const [online, setOnline] = useState(true);
  // Pulso de status apenas visual (hidrata após montar, sem tocar elegibilidade)
  useEffect(() => {
    const id = setInterval(() => setOnline((v) => v), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_90%_at_50%_-10%,oklch(0.65_0.16_260/0.22),transparent_70%)]" />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[1px]"
            style={{ background: `linear-gradient(90deg,transparent,${EMBER},transparent)`, opacity: 0.5 }}
          />
          <div className="relative mx-auto max-w-5xl px-4 pt-16 pb-16 md:pt-24 md:pb-24">
            <motion.div
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}
            >
              <div className="flex items-center gap-3 text-xs font-semibold tracking-wide">
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
                  style={{ borderColor: `${EMBER}55`, color: EMBER, background: `${EMBER}12` }}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: EMBER }} />
                    <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: EMBER }} />
                  </span>
                  REMOTE // {online ? "ONLINE" : "STANDBY"}
                </span>
                <span className="rounded-full border border-border/60 px-3 py-1.5 text-muted-foreground">BUILD 4.5</span>
              </div>

              <h1 className="mt-7 font-display text-5xl font-black leading-[0.92] tracking-tight md:text-7xl">
                Gangstar <span className="text-primary">Remote</span>
                <span className="block text-muted-foreground/40">4.5</span>
              </h1>

              <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
                A unidade remota da Shadow pra Gangstar. <span className="text-foreground">All Banks, bancos liberados sem restrições ou detecções</span>, encrypter indetectável e bypass nativo — tudo controlado pelo painel, com ativação rápida pela equipe.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href="#planos">
                  <Button size="lg" className="h-12 rounded-xl px-7 text-sm font-semibold shadow-lg shadow-primary/40 hover:shadow-primary/60">
                    Ativar minha unidade <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </a>
                <a href="#como-funciona">
                  <Button size="lg" variant="outline" className="h-12 rounded-xl border-border/60 px-6 text-sm font-semibold">
                    Como funciona
                  </Button>
                </a>
              </div>
            </motion.div>

            {/* Mini-console tático */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-12 overflow-hidden rounded-2xl border border-border/60 bg-card/50 backdrop-blur"
            >
              <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                <span className="ml-2 font-mono text-xs text-muted-foreground">shadow://remote/gangstar-4.5</span>
              </div>
              <div className="grid gap-px bg-border/60 sm:grid-cols-3">
                {[
                  { k: "Núcleo", v: "4.5 estável", icon: Cpu },
                  { k: "Proteção", v: "Encrypter + Bypass", icon: ShieldCheck },
                  { k: "Destaque", v: "All Banks ∞", icon: Zap },
                ].map((s) => (
                  <div key={s.k} className="bg-card/60 px-4 py-4">
                    <s.icon className="mb-2 h-4 w-4 text-primary" />
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.k}</div>
                    <div className="font-display text-base font-bold">{s.v}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="mx-auto max-w-5xl px-4 py-16">
          <p className="text-sm font-semibold text-primary">A unidade</p>
          <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight md:text-4xl">O que a Remote 4.5 entrega</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.t} className="border-border/60 bg-card/40 p-5 transition-colors hover:border-primary/40">
                <f.icon className="mb-3 h-5 w-5 text-primary" />
                <h3 className="font-bold">{f.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="scroll-mt-24 border-y border-border/60 bg-card/20">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <p className="text-sm font-semibold text-primary">Em 3 passos</p>
            <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight md:text-4xl">Do acesso ao comando</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <div key={s.t} className="rounded-2xl border border-border/60 bg-card/40 p-6">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 font-display text-sm font-black text-primary">{i + 1}</div>
                  <s.icon className="mb-3 h-5 w-5 text-primary" />
                  <h3 className="text-lg font-bold">{s.t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CONFIANÇA */}
        <section className="mx-auto max-w-5xl px-4 py-16">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Radio, t: "Status transparente", d: "Online é online. Você vê antes de entrar." },
              { icon: ShieldCheck, t: "Acesso que segura", d: "Feito pra manter a sessão viva, não pra cair no primeiro aperto." },
              { icon: Headset, t: "Equipe junto", d: "Suporte da Shadow do seu lado na ativação e no dia a dia." },
            ].map((t) => (
              <div key={t.t} className="flex gap-3 rounded-2xl border border-border/60 bg-card/40 p-5">
                <t.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <div className="font-bold">{t.t}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{t.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PLANOS */}
        <section id="planos" className="scroll-mt-24 border-t border-border/60 bg-card/20">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <p className="text-sm font-semibold text-primary">Planos</p>
            <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight md:text-4xl">Escolhe e ativa</h2>
            <p className="mt-2 max-w-md text-muted-foreground">Pagamento pela Cakto, ativação rápida pela equipe. Sem fidelidade — você escolhe a janela.</p>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {PLANS.map((p) => (
                <div
                  key={p.name}
                  className={`relative flex flex-col rounded-3xl border p-7 ${
                    p.featured ? "bg-card/60" : "border-border/60 bg-card/40"
                  }`}
                  style={p.featured ? { borderColor: `${EMBER}66`, boxShadow: `0 0 0 1px ${EMBER}22, 0 24px 60px -30px ${EMBER}55` } : undefined}
                >
                  {p.featured && (
                    <span
                      className="absolute right-6 top-6 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
                      style={{ color: EMBER, background: `${EMBER}1a`, border: `1px solid ${EMBER}55` }}
                    >
                      Melhor valor
                    </span>
                  )}
                  <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{p.name}</div>
                  <div className="mt-3 flex items-end gap-1.5">
                    <span className="font-display text-2xl font-bold text-muted-foreground">R$</span>
                    <span className="font-display text-6xl font-black leading-none" style={p.featured ? { color: EMBER } : { color: "oklch(0.65 0.16 260)" }}>{p.price}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{p.duration}</div>
                  <p className="mt-3 text-sm text-muted-foreground">{p.note}</p>

                  <ul className="mt-5 space-y-2.5">
                    {p.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={p.featured ? { color: EMBER } : { color: "oklch(0.65 0.16 260)" }} />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>

                  <a href={p.href} target="_blank" rel="noopener noreferrer" className="mt-7">
                    {p.featured ? (
                      <Button
                        size="lg"
                        className="h-12 w-full rounded-xl text-sm font-semibold text-white"
                        style={{ background: EMBER, boxShadow: `0 12px 30px -10px ${EMBER}aa` }}
                      >
                        Assinar o Mensal <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="lg" variant="outline" className="h-12 w-full rounded-xl border-border/60 text-sm font-semibold">
                        Assinar o Semanal
                      </Button>
                    )}
                  </a>
                </div>
              ))}
            </div>

            <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 text-primary/70" /> Pagamento processado pela Cakto em ambiente externo seguro.
            </p>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="px-4 pb-24 pt-16">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-primary/30 bg-card/40 p-10 text-center md:p-14">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(90%_120%_at_50%_0,oklch(0.65_0.16_260/0.16),transparent_70%)]" />
            <div className="relative">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                <SatelliteDish className="h-6 w-6 text-primary" />
              </div>
              <h2 className="font-display text-3xl font-black tracking-tight md:text-4xl">Coloca a Remote 4.5 pra rodar</h2>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">Ativação rápida pela equipe. Escolhe o plano e a unidade sobe pro seu painel.</p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <a href="#planos">
                  <Button size="lg" className="h-12 rounded-xl px-8 text-sm font-semibold shadow-lg shadow-primary/40 hover:shadow-primary/60">
                    Ver planos e ativar <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </a>
                <Link to="/contato">
                  <Button size="lg" variant="outline" className="h-12 rounded-xl border-border/60 px-6 text-sm font-semibold">
                    Falar com a equipe
                  </Button>
                </Link>
              </div>
              <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary/70" /> Mesmo ecossistema Shadow — licença, suporte e segurança no padrão da casa.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
