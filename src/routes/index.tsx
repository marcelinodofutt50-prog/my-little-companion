import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, ChevronDown, Copy, Cpu, Fingerprint, Lock, ShieldCheck, Zap } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SocialProofStrip } from "@/components/SocialProof";
import { MobileStickyCTA } from "@/components/ConversionBoosters";
import { Testimonials } from "@/components/Testimonials";
import { ProofWall } from "@/components/ProofWall";
import { ImpossibleProof } from "@/components/ImpossibleProof";
import { BeforeAfter } from "@/components/BeforeAfter";
import { Button } from "@/components/ui/button";
import { formatBrl } from "@/lib/plans";
import { siteUrl } from "@/lib/site-url";
import { useI18n } from "@/lib/i18n";
import shadowMark from "@/assets/shadow-mask.png";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shadow — Your Shadow Everywhere" },
      {
        name: "description",
        content:
          "Shadow BTMOB: infraestrutura de OSINT e cybersegurança de alto nível. Licenças instantâneas via PIX, painel completo e código-fonte disponível.",
      },
      { property: "og:title", content: "Shadow — Your Shadow Everywhere" },
      { property: "og:description", content: "Licenças BTMOB com ativação automática via PIX, painel completo e suporte 24/7." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: siteUrl("/") }],

  }),
  component: LandingPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
});

const plans = [
  {
    slug: "login-7d",
    tier: "TIER_01",
    tierKey: null,
    name: "Weekly Ops",
    durationKey: "plan.7d.duration",
    price: 450,
    accent: "cyan",
    descKey: "plan.7d.desc",
    featureKeys: ["plan.f.panel", "plan.f.aes", "plan.f.support"],
    highlight: false,
  },
  {
    slug: "login-30d",
    tier: "TIER_02 · PRIORITÁRIO",
    tierKey: "plan.tier2",
    name: "Monthly Intel",
    durationKey: "plan.30d.duration",
    price: 750,
    accent: "neon",
    descKey: "plan.30d.desc",
    featureKeys: ["plan.f.allweekly", "plan.f.queue", "plan.f.trial"],
    highlight: true,
  },
  {
    slug: "login-lifetime",
    tier: "TIER_03",
    tierKey: null,
    name: "Eternal",
    durationKey: "plan.life.duration",
    price: 1700,
    accent: "violet",
    descKey: "plan.life.desc",
    featureKeys: ["plan.f.lifetime", "plan.f.updates", "plan.f.vip"],
    highlight: false,
  },
] as const;

const sourcePlans = [
  {
    tier: "SRC_YAARSA",
    nameKey: "src.panel.name",
    price: 2700,
    accent: "cyan",
    descKey: "src.panel.desc",
  },
  {
    tier: "SRC_FULL",
    nameKey: "src.full.name",
    price: 4600,
    accent: "violet",
    descKey: "src.full.desc",
  },
] as const;


const features = [
  { icon: Lock, titleKey: "feat.aes.title", descKey: "feat.aes.desc" },
  { icon: Zap, titleKey: "feat.pix.title", descKey: "feat.pix.desc" },
  { icon: ShieldCheck, titleKey: "feat.anon.title", descKey: "feat.anon.desc" },
  { icon: Cpu, titleKey: "feat.panel.title", descKey: "feat.panel.desc" },
  { icon: Fingerprint, titleKey: "feat.trial.title", descKey: "feat.trial.desc" },
  { icon: Activity, titleKey: "feat.renew.title", descKey: "feat.renew.desc" },
] as const;

function LandingPage() {
  const { t } = useI18n();
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.15]" />
      <div className="pointer-events-none fixed top-1/4 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-[var(--neon)] opacity-[0.05] blur-[140px]" />
      <div className="pointer-events-none fixed bottom-0 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[var(--violet)] opacity-[0.06] blur-[120px]" />

      <div className="relative z-10">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-6 pb-24 md:px-10 md:pb-0">

          {/* HERO — clean, brand-first */}
          <section className="relative flex min-h-[calc(100vh-80px)] flex-col items-center justify-center py-16 text-center">
            {/* Brand mark */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="absolute inset-0 -z-10 rounded-full bg-[var(--neon)] opacity-20 blur-3xl" />
              <img
                loading="lazy"
                src={shadowMark}
                alt="Shadow"
                width={160}
                height={160}
                className="h-28 w-28 md:h-36 md:w-36 drop-shadow-[0_0_40px_rgba(201,168,76,0.5)]"
              />
            </motion.div>

            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.7 }}
              className="mt-10 inline-flex items-center gap-2 rounded-full border border-neon/30 bg-neon/[0.04] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.32em] text-neon"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-neon pulse-dot" />
              Cyber Operations · Est. 2024
            </motion.div>

            {/* Wordmark / headline */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 font-display text-[15vw] leading-[0.9] tracking-[-0.04em] md:text-[9rem] lg:text-[11rem]"
            >
              SHADOW
            </motion.h1>

            {/* Slogan */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.8 }}
              className="mt-6 max-w-2xl font-display text-xl italic tracking-tight text-muted-foreground md:text-2xl"
            >
              Your shadow, <span className="text-foreground not-italic">everywhere.</span>
            </motion.p>

            {/* Sub-copy */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.8 }}
              className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground/80"
            >
              Infraestrutura de cybersegurança de alto desempenho. Provisionada
              em segundos. Blindada por padrão.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.05, duration: 0.7 }}
              className="mt-10 flex flex-wrap items-center justify-center gap-3"
            >
              <Link to="/planos">
                <Button className="group rounded-full bg-foreground px-8 py-6 font-mono text-[11px] uppercase tracking-[0.24em] text-background transition-all hover:bg-foreground/90">
                  Começar agora
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link
                to="/auth"
                className="group inline-flex items-center gap-2 rounded-full px-6 py-3 font-mono text-[11px] uppercase tracking-[0.24em] text-foreground/80 transition-colors hover:text-neon"
              >
                Testar grátis por 24h
                <span className="h-px w-6 bg-current transition-all group-hover:w-10" />
              </Link>
            </motion.div>

            {/* Trust ticker */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3, duration: 1 }}
              className="mt-20 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-t border-border/50 pt-8 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground"
            >
              <span className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-neon" /> 99.9% uptime</span>
              <span className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-cyan" /> AES-256-GCM</span>
              <span className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-violet" /> 2.400+ operadores</span>
              <span className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-neon" /> Suporte 24/7</span>
            </motion.div>

            {/* Scroll cue */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.6, duration: 1 }}
              className="mt-14 flex flex-col items-center gap-2 text-muted-foreground/60"
            >
              <span className="font-mono text-[9px] uppercase tracking-[0.32em]">scroll</span>
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            </motion.div>
          </section>

          {/* SOCIAL PROOF */}
          <SocialProofStrip />

          {/* FEATURES */}
          <section className="border-t border-border py-20">
            <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-neon">
                  // recursos
                </div>
                <h2 className="mt-3 font-display text-4xl md:text-5xl">
                  Blindagem <span className="italic text-cyan">nativa</span>.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                Cada camada foi desenhada para operações de alto risco. Zero superfície de
                exposição.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.titleKey}
                  className="group relative bg-card p-6 transition-colors hover:bg-secondary/50"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md border border-neon/30 bg-neon/5 text-neon transition-all group-hover:glow-neon">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-xl">{t(f.titleKey)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(f.descKey)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* PRICING — Cyber-terminal tactical tiers */}
          <section className="border-t border-border py-20 md:py-28">
            <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan">
                  // licenças
                </div>
                <h2 className="mt-3 font-display text-4xl md:text-6xl">
                  Acesso à <span className="italic text-neon">ferramenta</span>
                </h2>
              </div>
              <p className="max-w-sm text-right text-sm text-muted-foreground">
                Pagamento PIX automático · Liberação em segundos
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:items-start">
              {plans.map((p) => {
                const accentClass =
                  p.accent === "neon" ? "text-neon" : p.accent === "cyan" ? "text-cyan" : "text-violet";
                const borderClass =
                  p.accent === "neon" ? "border-neon/30 hover:border-neon/60" : p.accent === "cyan" ? "border-cyan/30 hover:border-cyan/60" : "border-violet/30 hover:border-violet/60";
                const bulletClass =
                  p.accent === "neon" ? "text-neon" : p.accent === "cyan" ? "text-cyan" : "text-violet";
                const statusLabel =
                  p.accent === "neon" ? "Tier: Alpha" : p.accent === "cyan" ? "Status: Active" : "Status: Infinite";
                const btnClass = p.highlight
                  ? "bg-cyan text-background hover:bg-cyan/85 shadow-[0_0_30px_rgba(6,182,212,0.35)]"
                  : p.accent === "cyan"
                    ? "bg-neon/10 text-neon border border-neon/40 hover:bg-neon/20"
                    : p.accent === "violet"
                      ? "bg-violet/10 text-violet border border-violet/40 hover:bg-violet/20"
                      : "bg-neon/10 text-neon border border-neon/40 hover:bg-neon/20";

                return (
                  <div
                    key={p.slug}
                    className={`relative flex flex-col rounded-lg p-8 transition-all duration-300 ${
                      p.highlight
                        ? "z-10 scale-[1.03] border-2 border-cyan bg-[#0d0d0d] shadow-[0_0_40px_rgba(6,182,212,0.12)]"
                        : `bg-[#0a0a0a] border ${borderClass}`
                    }`}
                  >
                    {p.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded bg-cyan px-3 py-1 font-mono text-[9px] font-black uppercase tracking-[0.2em] text-background">
                        Mais escolhido
                      </div>
                    )}
                    <div className={`absolute top-0 right-0 p-2 font-mono text-[9px] font-bold uppercase tracking-widest ${accentClass} opacity-40`}>
                      {statusLabel}
                    </div>

                    <div className={`mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] ${accentClass}`}>
                      {p.tier}
                    </div>
                    <h3 className="mt-3 font-display text-3xl tracking-tight">{p.name}</h3>

                    <div className="my-6 flex items-baseline gap-1 border-b border-border pb-6">
                      <span className={`font-display text-5xl tracking-tight ${accentClass}`}>
                        {formatBrl(p.price)}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        / {t(p.durationKey).toLowerCase()}
                      </span>
                    </div>

                    <ul className="mb-8 space-y-3 text-sm">
                      {p.featureKeys.map((fk) => (
                        <li key={fk} className="flex items-start gap-3 text-muted-foreground">
                          <span className={`font-mono text-xs font-bold ${bulletClass}`}>[+]</span>
                          <span>{t(fk)}</span>
                        </li>
                      ))}
                    </ul>

                    <Link to="/planos" className="mt-auto">
                      <Button
                        className={`w-full rounded-md py-6 font-mono text-[10px] font-black uppercase tracking-[0.24em] transition-all ${btnClass}`}
                      >
                        {p.highlight ? "Assinar agora" : "Comprar"}
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SOURCE CODE */}
          <section className="border-t border-border py-20">
            <div className="mb-12">
              <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-violet">
                // código-fonte
              </div>
              <h2 className="mt-3 font-display text-4xl md:text-5xl">
                Soberania <span className="italic text-violet">total</span>.
              </h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Para quem prefere rodar a infraestrutura por conta própria. Entrega por
                transferência criptografada.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {sourcePlans.map((p) => (
                <div
                  key={p.tier}
                  className="terminal-card group flex flex-col rounded-lg p-8 transition-all hover:-translate-y-1"
                >
                  <div
                    className={`font-mono text-[10px] uppercase tracking-[0.28em] ${
                      p.accent === "cyan" ? "text-cyan" : "text-violet"
                    }`}
                  >
                    {p.tier}
                  </div>
                  <h3 className="mt-3 font-display text-3xl">{t(p.nameKey)}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{t(p.descKey)}</p>
                  <div className="mt-6 flex items-end justify-between border-t border-border pt-6">
                    <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                      Aquisição única
                    </span>
                    <span
                      className={`font-display text-4xl ${
                        p.accent === "cyan" ? "text-cyan" : "text-violet"
                      }`}
                    >
                      {formatBrl(p.price)}
                    </span>
                  </div>
                  <Link to="/planos" className="mt-6">
                    <Button
                      variant="outline"
                      className={`w-full rounded-md border py-6 font-mono text-[10px] uppercase tracking-[0.24em] ${
                        p.accent === "cyan"
                          ? "border-cyan/50 text-cyan hover:bg-cyan/10"
                          : "border-violet/50 text-violet hover:bg-violet/10"
                      }`}
                    >
                      Solicitar
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* CASHBACK */}
          <section className="border-t border-border py-20">
            <div className="rgb-border relative overflow-hidden rounded-lg terminal-card p-10 md:p-14">
              <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-neon">
                    // cashback
                  </div>
                  <h2 className="mt-3 font-display text-4xl md:text-5xl">
                    <span className="text-neon">40%</span> de retorno no primeiro depósito.
                  </h2>
                  <p className="mt-4 max-w-xl text-muted-foreground">
                    Aplique o cupom no checkout. Após o pagamento aprovado, 40% do valor
                    retorna como saldo Shadow — utilizável em qualquer próxima compra ou
                    renovação mensal do servidor.
                  </p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("BTMOB40");
                    toast.success("Cupom BTMOB40 copiado");
                  }}
                  className="group flex items-center gap-5 rounded-md border border-neon/50 bg-neon/5 px-8 py-6 transition-all hover:bg-neon/10 hover:glow-neon"
                >
                  <div className="text-left">
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-neon">
                      Cupom
                    </div>
                    <div className="mt-1 font-mono text-2xl font-medium tracking-widest text-foreground">
                      BTMOB40
                    </div>
                  </div>
                  <Copy className="h-4 w-4 text-neon transition-transform group-hover:scale-110" />
                </button>
              </div>
            </div>
          </section>

          {/* Comprovantes Itaú e Caixa em destaque */}
          <section className="border-t border-border py-16">
            <ImpossibleProof />
          </section>

          {/* Proof Wall — prints reais */}
          <ProofWall />

          {/* Antes vs Depois */}
          <BeforeAfter />


          {/* Testimonials */}
          <Testimonials />

          {/* FAQ */}
          <section className="border-t border-border py-20">
            <div className="mb-10">
              <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan">
                // faq
              </div>
              <h2 className="mt-3 font-display text-4xl md:text-5xl">
                Perguntas <span className="italic text-cyan">frequentes</span>
              </h2>
            </div>
            <div className="rounded-lg border border-border terminal-card">
              {[
                {
                  q: "Como funciona o pagamento?",
                  a: "Totalmente automático via PIX (Mercado Pago). Você escolhe o plano, paga o QR Code e, assim que o Mercado Pago confirma, a licença é provisionada e aparece no seu painel — normalmente em menos de 60 segundos.",
                },
                {
                  q: "Como recebo minhas credenciais?",
                  a: "Após o pagamento aprovado, o sistema cria um usuário aleatório no servidor, criptografa a senha com AES-256-GCM e mostra usuário, e-mail, senha e IP do servidor no seu painel. Ninguém mais tem acesso ao texto claro.",
                },
                {
                  q: "Como funciona o cupom BTMOB40?",
                  a: "Aplique BTMOB40 no seu primeiro pedido. Após o pagamento aprovado, 40% do valor retorna como saldo Shadow, que você pode usar em qualquer próxima compra ou renovação de servidor.",
                },
                {
                  q: "E o trial de 1 dia?",
                  a: "Todo usuário novo pode ativar 1 trial de 1 dia, uma vez por conta, direto no painel. Serve para você testar o BTMOB antes de comprar.",
                },
                {
                  q: "Como funciona a renovação do servidor?",
                  a: "O servidor renova todo dia 20. Se a mensalidade de R$ 450 não for paga, a licença é revogada automaticamente até você renovar. Assim que o pagamento cai, o acesso volta na hora.",
                },
                {
                  q: "Vocês vendem o código-fonte?",
                  a: "Sim. Código-fonte do painel proprietário por R$ 2.700 e o pacote completo BTMOB + servidor por R$ 4.600. Independência total para você hospedar tudo em ambiente próprio.",
                },
              ].map((item, i) => (
                <FaqItem key={i} q={item.q} a={item.a} />
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="border-t border-border py-20 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-neon">
              // pronto para começar?
            </div>
            <h2 className="mx-auto mt-4 max-w-3xl font-display text-4xl md:text-6xl">
              Entra na <span className="text-neon">Shadow</span> e opere{" "}
              <span className="italic text-violet">sem deixar rastros</span>.
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/planos">
                <Button className="rounded-md bg-neon px-10 py-6 font-mono text-xs uppercase tracking-[0.22em] text-background hover:bg-neon/90 glow-neon">
                  Ver planos
                </Button>
              </Link>
              <Link to="/auth">
                <Button
                  variant="outline"
                  className="rounded-md border-cyan/60 px-10 py-6 font-mono text-xs uppercase tracking-[0.22em] text-cyan hover:bg-cyan/10"
                >
                  Ativar trial
                </Button>
              </Link>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="mt-20 border-t border-border pt-10 pb-12">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <div className="font-display text-2xl text-neon">SHADOW</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  Your shadow everywhere · v4.6
                </div>
              </div>
              <div className="flex flex-wrap gap-8 font-mono text-[10px] uppercase tracking-[0.24em]">
                <Link to="/planos" className="hover:text-neon">Planos</Link>
                <Link to="/tutorial" className="hover:text-neon">Tutorial</Link>
                <Link to="/contato" className="hover:text-neon">Contato</Link>
                <Link to="/termos" className="hover:text-neon">Termos</Link>
                <Link to="/privacidade" className="hover:text-neon">Privacidade</Link>

                <a
                  href="mailto:suportekremlin@gmail.com"
                  className="hover:text-neon"
                >
                  suportekremlin@gmail.com
                </a>
              </div>
            </div>
            <div className="mt-8 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              © {new Date().getFullYear()} Shadow · Secure OSINT Infrastructure
            </div>
          </footer>
        </main>
        <MobileStickyCTA label="Ver planos" to="/planos" />

      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left transition-colors hover:bg-secondary/40"
      >
        <span className="font-display text-lg md:text-xl">{q}</span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-neon transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-6 pb-6 text-sm leading-relaxed text-muted-foreground">{a}</div>
      )}
    </div>
  );
}
