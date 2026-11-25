import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Radio, ShieldCheck, Cpu, Fingerprint, SatelliteDish,
  Terminal, Zap, ArrowRight, CheckCircle2, Lock, Headset,
  Crown, BadgeCheck, Clock, CreditCard, XCircle, Plus, PlayCircle, AlertTriangle, Ticket,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
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
const BLUE = "oklch(0.65 0.16 260)";
const ember = (a: number) => `oklch(0.72 0.17 55 / ${a})`;
const blue = (a: number) => `oklch(0.65 0.16 260 / ${a})`;

const FEATURES = [
  { icon: Zap, t: "All Banks", d: "Bancos sem alertas, sem detecções e sem bloqueios de Pix." },
  { icon: Fingerprint, t: "Encrypter indetectável", d: "Mantém a unidade oculta da detecção: obfuscação v1, v2, v3, v4, VPN e proxy interno no sistema." },
  { icon: ShieldCheck, t: "Bypass nativo", d: "Proteção embutida no núcleo 4.5: segura o acesso sem depender de nada externo." },
  { icon: Radio, t: "Bypass Website", d: "Passa pela verificação de site sem travar a sua entrada na unidade." },
  { icon: Cpu, t: "Funções exclusivas", d: "Recursos que só a Remote 4.5 entrega — além do pacote padrão de mod." },
  { icon: Terminal, t: "Credenciais pelo painel", d: "Seu login aparece direto no painel Shadow, pronto pra usar na hora." },
];

const STEPS = [
  { icon: Lock, t: "Ative a licença", d: "Garante seu acesso pelos planos e a equipe libera a unidade na hora." },
  { icon: Terminal, t: "Conecte ao painel", d: "Abre o painel Shadow, a unidade Remote 4.5 aparece com o status atual." },
  { icon: Zap, t: "Comando e operação", d: "Operação mais completa, com menos problemas e mais simples de entender que a BTMob." },
];

type RemotePlan = {
  name: string;
  tagline: string;
  price: string;
  per: string;
  duration: string;
  save: string | null;
  note: string;
  perks: string[];
  cta: string;
  href: string;
  featured: boolean;
  icon: typeof Clock;
};

const PLANS: RemotePlan[] = [
  {
    name: "Semanal",
    tagline: "Janela curta",
    price: "1.800",
    per: "/semana",
    duration: "Acesso por 7 dias",
    save: null,
    note: "Pra testar a unidade completa ou operar numa janela curta.",
    perks: [
      "All Banks — dinheiro infinito no jogo",
      "Bypass nativo",
      "Encrypter indetectável",
      "Credenciais pelo painel",
      "Suporte da equipe",
    ],
    cta: "Assinar o Semanal",
    href: "https://pay.cakto.com.br/cxwfetz_1350896",
    featured: false,
    icon: Clock,
  },
  {
    name: "Mensal",
    tagline: "Operação contínua",
    price: "4.000",
    per: "/mês",
    duration: "Acesso por 30 dias",
    save: "≈ R$ 933/semana · ~48% mais barato que o semanal",
    note: "A unidade inteira pra quem roda sério todo dia.",
    perks: [
      "Tudo do plano Semanal",
      "Funções exclusivas da Remote 4.5",
      "Bypass Website",
      "Encrypter sempre atualizado",
      "Prioridade no suporte",
      "Status ao vivo no painel",
    ],
    cta: "Assinar o Mensal",
    href: "https://pay.cakto.com.br/9mdeqxs_1349153",
    featured: true,
    icon: Crown,
  },
];

// Comparativo: BTMob (opção mais em conta) x Gangstar Remote 4.5
type CompareRow = { label: string; btmob: string | boolean; gangstar: string | boolean };
const COMPARE: CompareRow[] = [
  { label: "All Banks — dinheiro infinito", btmob: false, gangstar: true },
  { label: "Encrypter", btmob: false, gangstar: true },
  { label: "Detecção", btmob: "Detectável", gangstar: "Indetectável" },
  { label: "Bypass Website", btmob: false, gangstar: true },
  { label: "Funções exclusivas", btmob: false, gangstar: true },
  { label: "Custo", btmob: "Mais em conta", gangstar: "Premium" },
];

// Vídeos de apresentação (YouTube). Títulos/descrições são copy editável.
const VIDEOS = [
  { id: "iUZDRXpPMyg", eyebrow: "Apresentação", title: "Gangstar Remote 4.5 em ação", desc: "A unidade rodando de verdade: All Banks, encrypter e o controle direto pelo painel." },
  { id: "8go6JspsQds", eyebrow: "Mais um giro", title: "Por dentro do mod", desc: "Outro ângulo da Remote 4.5 funcionando, do painel até o jogo." },
];

function GangstarRemotePage() {
  const [online, setOnline] = useState(true);
  const [checkout, setCheckout] = useState<RemotePlan | null>(null);
  // Pulso de status apenas visual (hidrata após montar, sem tocar elegibilidade)
  useEffect(() => {
    const id = setInterval(() => setOnline((v) => v), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main>
        {/* PARCERIA OFICIAL (topo) */}
        <section className="px-4 pt-6">
          <div className="mx-auto max-w-5xl">
            <div className="relative overflow-hidden rounded-2xl border p-4 md:p-5" style={{ borderColor: ember(0.28), background: `linear-gradient(90deg,${ember(0.06)},transparent 70%)` }}>
              <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:gap-4 sm:text-left">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border" style={{ borderColor: ember(0.33), background: ember(0.09), color: EMBER }}>
                  <Crown className="h-6 w-6" />
                </span>
                <div>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide sm:justify-start" style={{ color: EMBER }}>
                    <BadgeCheck className="h-3.5 w-3.5" /> Parceria oficial
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-foreground md:text-base">
                    A <span className="font-semibold">ShadowDashStore</span> é parceira oficial da <span className="font-semibold" style={{ color: EMBER }}>UniãoDos7</span> — grupo de alta elite, de Rauls destemidos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_90%_at_50%_-10%,oklch(0.65_0.16_260/0.18),transparent_70%)]" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                "linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)",
              backgroundSize: "46px 46px",
              maskImage: "radial-gradient(70% 70% at 50% 30%, #000, transparent)",
              WebkitMaskImage: "radial-gradient(70% 70% at 50% 30%, #000, transparent)",
            }}
          />
          <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-4 pt-14 pb-14 md:pt-20 md:pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            {/* Pitch */}
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold tracking-wide">
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
                  style={{ borderColor: ember(0.33), color: EMBER, background: ember(0.07) }}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: EMBER }} />
                    <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: EMBER }} />
                  </span>
                  REMOTE // {online ? "ONLINE" : "STANDBY"}
                </span>
                <span className="rounded-full border border-border/50 px-3 py-1.5 text-muted-foreground">BUILD 4.5</span>
              </div>

              <h1 className="mt-7 font-display text-5xl font-black leading-[0.9] tracking-tight md:text-6xl lg:text-7xl">
                Gangstar <span className="text-primary">Remote</span>
                <span className="mt-1 block text-transparent" style={{ WebkitTextStroke: `1.5px ${ember(0.55)}` }}>4.5</span>
              </h1>

              <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
                A unidade remota da Shadow pra Gangstar. <span className="text-foreground">All Banks, bancos liberados sem restrições ou detecções</span>, encrypter indetectável e bypass nativo — tudo controlado pelo painel.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href="#planos">
                  <Button size="lg" className="h-12 rounded-xl px-7 text-sm font-semibold shadow-lg shadow-primary/40 hover:shadow-primary/60">
                    Ativar minha unidade <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </a>
                <a href="#como-funciona">
                  <Button size="lg" variant="outline" className="h-12 rounded-xl border-border/50 px-6 text-sm font-semibold">
                    Como funciona
                  </Button>
                </a>
              </div>
            </motion.div>

            {/* Painel de operação (HUD) */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
              className="overflow-hidden rounded-2xl border bg-card/50 shadow-2xl shadow-black/40 backdrop-blur"
              style={{ borderColor: ember(0.22) }}
            >
              <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                <span className="ml-2 font-mono text-[11px] text-muted-foreground">shadow://remote/gangstar-4.5</span>
                <span className="ml-auto font-mono text-[10px] font-semibold" style={{ color: EMBER }}>
                  {online ? "ONLINE" : "STANDBY"}
                </span>
              </div>
              <div className="divide-y divide-border/40">
                {[
                  { k: "NÚCLEO", v: "4.5 estável" },
                  { k: "ENCRYPTER", v: "v1 · v2 · v3 · v4" },
                  { k: "ALL BANKS", v: "liberado" },
                  { k: "BYPASS", v: "nativo + website" },
                  { k: "DETECÇÃO", v: "oculta · VPN/proxy" },
                ].map((r) => (
                  <div key={r.k} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{r.k}</span>
                    <span className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{r.v}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/60" />
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border/50 bg-background/40 px-4 py-3 font-mono text-xs">
                <span className="text-muted-foreground">&gt; </span>
                <span className="text-foreground">inject --unit remote-4.5 --stealth</span>
                <span className="ml-0.5 inline-block h-3.5 w-[7px] translate-y-0.5 animate-pulse align-middle" style={{ background: EMBER }} />
              </div>
            </motion.div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="mx-auto max-w-5xl px-4 py-14 md:py-16">
          <p className="text-sm font-semibold text-primary">Ficha técnica</p>
          <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight md:text-4xl">Análise da unidade 4.5</h2>
          <p className="mt-3 font-mono text-xs text-muted-foreground">{"// "}{FEATURES.length} módulos · núcleo 4.5 · status: operacional</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.t} className="border-border/50 bg-card/40 p-6 transition-colors hover:border-primary/40">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/5">
                  <f.icon className="h-5 w-5 text-primary" />
                </span>
                <h3 className="mt-4 font-semibold">{f.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="scroll-mt-24 border-y border-border/50 bg-card/20">
          <div className="mx-auto max-w-5xl px-4 py-14 md:py-16">
            <p className="text-sm font-semibold text-primary">Em 3 passos</p>
            <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight md:text-4xl">Do acesso ao comando</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <div key={s.t} className="rounded-2xl border border-border/50 bg-card/40 p-6">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 font-display text-sm font-black text-primary">{i + 1}</div>
                  <s.icon className="mb-3 h-5 w-5 text-primary" />
                  <h3 className="text-lg font-bold">{s.t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* VÍDEOS */}
        <section className="mx-auto max-w-5xl px-4 py-14 md:py-16">
          <p className="text-sm font-semibold text-primary">Na prática</p>
          <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight md:text-4xl">Veja a Remote 4.5 rodando</h2>
          <p className="mt-2 max-w-md text-muted-foreground">Dois vídeos mostrando a unidade em ação — do painel ao jogo.</p>

          <div className="mt-8 space-y-8">
            {VIDEOS.map((v) => (
              <div key={v.id}>
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <PlayCircle className="h-4 w-4" /> {v.eyebrow}
                </div>
                <h3 className="mt-1.5 font-display text-xl font-bold md:text-2xl">{v.title}</h3>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">{v.desc}</p>
                <div className="mt-4 overflow-hidden rounded-2xl border border-border/50 bg-black shadow-xl shadow-black/40">
                  <div className="aspect-video w-full">
                    <iframe
                      className="h-full w-full"
                      src={`https://www.youtube-nocookie.com/embed/${v.id}`}
                      title={v.title}
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CONFIANÇA */}
        <section className="mx-auto max-w-5xl px-4 py-14 md:py-16">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Radio, t: "Status transparente", d: "Online é online. Você vê antes de entrar." },
              { icon: ShieldCheck, t: "Acesso que segura", d: "Feito pra manter a sessão viva, não pra cair no primeiro aperto." },
              { icon: Headset, t: "Equipe junto", d: "Suporte da Shadow do seu lado na ativação e no dia a dia." },
            ].map((t) => (
              <div key={t.t} className="flex gap-3 rounded-2xl border border-border/50 bg-card/40 p-5">
                <t.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <div className="font-bold">{t.t}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{t.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* COMPARATIVO */}
        <section className="mx-auto max-w-5xl px-4 py-14 md:py-16">
          <p className="text-sm font-semibold text-primary">Comparativo</p>
          <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight md:text-4xl">BTMob ou Gangstar Remote?</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            A BTMob é a opção mais em conta pra começar, mas é detectável. A Remote 4.5 é a unidade premium: All Banks, encrypter e indetectável.
          </p>

          <div className="mt-8 overflow-hidden rounded-2xl border border-border/50">
            <div className="grid grid-cols-[1.3fr_1fr_1fr] text-sm">
              <div className="px-4 py-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Recurso</div>
              <div className="border-l border-border/50 px-3 py-4 text-center">
                <div className="font-display font-bold">BTMob</div>
                <div className="text-[11px] text-muted-foreground">Mais em conta</div>
              </div>
              <div className="relative border-l px-3 py-4 text-center" style={{ borderColor: ember(0.2), background: ember(0.08) }}>
                <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5" style={{ background: EMBER }} />
                <div className="flex items-center justify-center gap-1.5 font-display font-bold" style={{ color: EMBER }}>
                  <Crown className="h-3.5 w-3.5" /> Remote 4.5
                </div>
                <div className="text-[11px] text-muted-foreground">Recomendado</div>
              </div>
            </div>
            {COMPARE.map((row, i) => (
              <div key={row.label} className={`grid grid-cols-[1.3fr_1fr_1fr] items-center border-t border-border/50 text-sm ${i % 2 ? "bg-card/20" : ""}`}>
                <div className="px-4 py-3.5">{row.label}</div>
                <div className="flex items-center justify-center border-l border-border/50 px-3 py-3.5 text-center text-muted-foreground">
                  {typeof row.btmob === "boolean"
                    ? (row.btmob ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 opacity-40" />)
                    : <span>{row.btmob}</span>}
                </div>
                <div className="flex items-center justify-center border-l px-3 py-3.5 text-center" style={{ borderColor: ember(0.2), background: ember(0.04) }}>
                  {typeof row.gangstar === "boolean"
                    ? (row.gangstar ? <CheckCircle2 className="h-4 w-4" style={{ color: EMBER }} /> : <XCircle className="h-4 w-4 opacity-40" />)
                    : <span className="font-medium" style={{ color: EMBER }}>{row.gangstar}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PLANOS */}
        <section id="planos" className="scroll-mt-24 border-t border-border/50 bg-card/20">
          <div className="mx-auto max-w-5xl px-4 py-14 md:py-16">
            <p className="text-sm font-semibold text-primary">Planos</p>
            <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight md:text-4xl">Escolhe e ativa</h2>
            <p className="mt-2 max-w-md text-muted-foreground">Pagamento pela Cakto, ativação rápida pela equipe. Sem fidelidade — você escolhe a janela.</p>

            <div className="mt-8 grid items-start gap-5 sm:grid-cols-2">
              {PLANS.map((p) => {
                const accent = p.featured ? EMBER : BLUE;
                const accentA = p.featured ? ember : blue;
                return (
                  <div
                    key={p.name}
                    className={`group relative flex flex-col overflow-hidden rounded-3xl border p-7 ${
                      p.featured ? "bg-gradient-to-b from-card/70 to-card/40" : "border-border/50 bg-card/40"
                    }`}
                    style={p.featured ? { borderColor: ember(0.4), boxShadow: `0 0 0 1px ${ember(0.13)}, 0 30px 70px -32px ${ember(0.4)}` } : undefined}
                  >
                    {p.featured && (
                      <span className="pointer-events-none absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg,transparent,${EMBER},transparent)` }} />
                    )}
                    {p.featured && (
                      <span className="absolute right-6 top-6 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: EMBER, background: ember(0.1), border: `1px solid ${ember(0.33)}` }}>
                        Melhor valor
                      </span>
                    )}

                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border" style={{ borderColor: accentA(0.33), background: accentA(0.08), color: accent }}>
                        <p.icon className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="font-display text-lg font-bold">{p.name}</div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">{p.tagline}</div>
                      </div>
                    </div>

                    <div className="mt-6 flex items-end gap-1.5">
                      <span className="font-display text-xl font-bold text-muted-foreground">R$</span>
                      <span className="font-display text-6xl font-black leading-none" style={{ color: accent }}>{p.price}</span>
                      <span className="mb-1 text-sm text-muted-foreground">{p.per}</span>
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {p.duration}
                    </div>
                    {p.save && (
                      <div className="mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: EMBER, background: ember(0.08), border: `1px solid ${ember(0.25)}` }}>
                        <Zap className="h-3 w-3" /> {p.save}
                      </div>
                    )}
                    <p className="mt-4 text-sm text-muted-foreground">{p.note}</p>

                    <div className="my-6 h-px bg-border/60" />

                    <ul className="space-y-3">
                      {p.perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-2.5 text-sm">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-8">
                      {p.featured ? (
                        <Button onClick={() => setCheckout(p)} size="lg" className="h-12 w-full rounded-xl text-sm font-semibold text-white transition-transform group-hover:scale-[1.02]" style={{ background: EMBER, boxShadow: `0 14px 34px -12px ${ember(0.66)}` }}>
                          {p.cta} <ArrowRight className="ml-1.5 h-4 w-4" />
                        </Button>
                      ) : (
                        <Button onClick={() => setCheckout(p)} size="lg" variant="outline" className="h-12 w-full rounded-xl border-border/50 text-sm font-semibold">
                          {p.cta}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2.5 text-xs">
              {[
                { icon: Zap, t: "Ativação rápida" },
                { icon: Lock, t: "Pagamento seguro pela Cakto" },
                { icon: Clock, t: "Sem fidelidade" },
              ].map((c) => (
                <span key={c.t} className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/40 px-3 py-1.5 text-muted-foreground">
                  <c.icon className="h-3.5 w-3.5 text-primary/70" /> {c.t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ADD-ON AVULSO */}
        <section className="mx-auto max-w-5xl px-4 pt-10">
          <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-card/40 p-7 md:p-8">
            <div className="relative grid gap-6 md:grid-cols-[1.5fr_1fr] md:items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Plus className="h-3.5 w-3.5" /> Avulso pra quem já tem BTMob
                </span>
                <h3 className="mt-3 font-display text-2xl font-bold tracking-tight">Encrypter + Bypass da Gangstar, por fora</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Já roda a BTMob e só quer o que falta? Leva o encrypter e o bypass da Gangstar separados e deixa o seu setup indetectável — sem trocar de painel.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Link to="/contato">
                  <Button size="lg" className="h-12 w-full rounded-xl text-sm font-semibold">Quero o avulso</Button>
                </Link>
                <span className="text-center text-[11px] text-muted-foreground">Valor e ativação direto com a equipe.</span>
              </div>
            </div>
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
                  <Button size="lg" variant="outline" className="h-12 rounded-xl border-border/50 px-6 text-sm font-semibold">
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

      {/* CHECKOUT MODAL */}
      <Dialog open={!!checkout} onOpenChange={(o) => !o && setCheckout(null)}>
        <DialogContent className="max-w-md border-border/50">
          {checkout && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">
                  Gangstar Remote 4.5 — {checkout.name}
                </DialogTitle>
                <DialogDescription>
                  {checkout.duration} · ativação rápida pela equipe
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-xl border border-border/50 bg-card/40 p-4">
                <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Incluso</div>
                <ul className="space-y-2">
                  {checkout.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: checkout.featured ? EMBER : BLUE }} />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className="flex items-end justify-between rounded-xl border p-4"
                style={checkout.featured ? { borderColor: ember(0.3), background: ember(0.06) } : { borderColor: blue(0.3), background: blue(0.06) }}
              >
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5" /> Cartão ou Pix pela Cakto
                  </div>
                </div>
                <div className="flex items-end gap-1" style={{ color: checkout.featured ? EMBER : BLUE }}>
                  <span className="font-display text-sm font-bold">R$</span>
                  <span className="font-display text-3xl font-black leading-none">{checkout.price}</span>
                  <span className="mb-0.5 text-xs text-muted-foreground">{checkout.per}</span>
                </div>
              </div>

              <div
                className="flex gap-2.5 rounded-xl border p-3"
                style={{ borderColor: "oklch(0.72 0.15 70 / 0.4)", background: "oklch(0.72 0.15 70 / 0.08)" }}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "oklch(0.78 0.15 70)" }} />
                <div className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Sem entrega automática.</span> Esse checkout não libera na hora como o Mercado Pago. Depois de pagar, <span className="font-semibold text-foreground">abra um ticket no suporte com o comprovante</span> para a equipe concluir a ativação.
                </div>
              </div>

              <DialogFooter className="mt-1">
                <a href={checkout.href} target="_blank" rel="noopener noreferrer" className="w-full">
                  <Button
                    size="lg"
                    className="h-12 w-full rounded-xl text-sm font-semibold text-white"
                    style={checkout.featured ? { background: EMBER, boxShadow: `0 14px 34px -12px ${ember(0.66)}` } : undefined}
                  >
                    Ir para o pagamento <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </a>
              </DialogFooter>
              <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
                <Ticket className="h-3.5 w-3.5 text-primary/70" /> Pague e envie o comprovante no suporte para ativar.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
