import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Shield, Zap, Lock, HeadphonesIcon, ChevronRight, CheckCircle2, Terminal, Globe, ShieldCheck, Database, Server, Rocket, ArrowRight, UserCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { ProgressiveImage } from "@/components/ProgressiveImage";
import { siteUrl } from "@/lib/site-url";
import { useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useThemeSearchParam } from "@/hooks/use-theme-param";
import { toast } from "sonner";
import { SocialProofStrip } from "@/components/SocialProof";
import { MobileStickyCTA } from "@/components/ConversionBoosters";
import { Testimonials } from "@/components/Testimonials";
import { ProofWall } from "@/components/ProofWall";
import { ImpossibleProof } from "@/components/ImpossibleProof";
import { BeforeAfter } from "@/components/BeforeAfter";
import { Button } from "@/components/ui/button";
import { formatBrl } from "@/lib/plans";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { playNotifyDing } from "@/lib/notify-sound";
import shadowMark from "@/assets/shadow-mark.png";
import heroRestoreAsset from "@/assets/shadow-hero-restore.png.asset.json";
import heroClassicAsset from "@/assets/shadow-hero-classic.png.asset.json";
import btmobDashboardAsset from "@/assets/btmob-new-dashboard.png.asset.json";
import assetMissingAsset from "@/assets/image-97.png.asset.json";
import btmobPanel1 from "@/assets/btmob-panel-1.png.asset.json";
import btmobPanel2 from "@/assets/btmob-panel-2.png.asset.json";

const heroRestore = heroRestoreAsset.url;
const heroClassic = heroClassicAsset.url;
const btmobDashboard = btmobDashboardAsset.url;
const assetMissing = assetMissingAsset.url;
const btmob1 = btmobPanel1.url;
const btmob2 = btmobPanel2.url;

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Shadow — OSINT & Digital Asset Manager" },
    { name: "description", content: "O ecossistema definitivo para quem opera nas sombras. Bypass Play Protect, Shadow Signer e infraestrutura VPS dedicada." },
    { property: "og:title", content: "Shadow — OSINT & Digital Asset Manager" },
    { property: "og:description", content: "Acesse a elite do gerenciamento de ativos digitais. Ativação instantânea via Mercado Pago." },
    { property: "og:type", content: "website" },
    { property: "og:url", content: siteUrl("/") },
    { name: "twitter:card", content: "summary_large_image" },
    { property: "og:image", content: siteUrl("/og-image.png") },
    { name: "twitter:image", content: siteUrl("/og-image.png") },
  ], links: [{ rel: "canonical", href: siteUrl("/") }] }),
  component: Index,
});

function Index() {
  const search = useSearch({ from: "/" }) as any;
  useThemeSearchParam(search?.theme);
  const { t } = useI18n();

  useEffect(() => {
    if (search?.success === 'true') {
      playNotifyDing();
      toast.success("Acesso liberado com sucesso!", { duration: 5000 });
    }
  }, [search?.success]);

  return (
    <div className="relative min-h-screen overflow-hidden selection:bg-primary/30">
      <SiteHeader />
      
      {/* Hero Section */}
      <section className="relative pt-16 pb-12 md:pt-24 md:pb-20">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 12, stiffness: 200 }}
            className="mx-auto mb-8 h-40 w-40 md:h-56 md:w-56"
          >
            <ProgressiveImage 
              src={shadowMark} 
              alt="Shadow Protocol"
              className="h-full w-full object-contain drop-shadow-[0_0_20px_oklch(0.78_0.13_82/0.4)]"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Cyber Operations · Est. 2024
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 font-display text-5xl font-bold leading-[0.9] tracking-tighter md:text-7xl lg:text-9xl text-foreground"
          >
            SHADOW
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg font-medium text-muted-foreground md:text-xl"
          >
            Your <span className="text-foreground italic">shadow</span>, everywhere.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground/60"
          >
            Infraestrutura de cybersegurança de alto desempenho. Provisionada em segundos. Blindada por padrão.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-6"
          >
            <Button size="lg" asChild className="h-14 px-10 text-xs font-mono uppercase tracking-widest rounded-full">
              <Link to="/planos">
                Começar Agora <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Link 
              to="/auth" 
              className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
            >
              Testar Grátis por 24h <span className="h-px w-8 bg-muted-foreground/30" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 flex flex-wrap justify-center gap-8 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/40"
          >
            <div className="flex items-center gap-2 tracking-tighter"><span className="text-primary">✦</span> 99.9% Uptime</div>
            <div className="flex items-center gap-2 tracking-tighter"><span className="text-primary">✦</span> AES-256-GCM</div>
            <div className="flex items-center gap-2 tracking-tighter"><span className="text-primary">✦</span> 2.400+ Operadores</div>
            <div className="flex items-center gap-2 tracking-tighter"><span className="text-primary">✦</span> Suporte 24/7</div>
          </motion.div>
        </div>
      </section>




      {/* Enterprise Management Section - Integrated Real UI Elements */}
      <section className="py-20 relative border-y border-border/40 bg-card/20 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                ALPHA-OPS CONSOLE V4.6
              </div>
              <h2 className="font-display text-4xl md:text-6xl font-bold leading-tight tracking-tight text-foreground">
                Gestão Empresarial <br />
                <span className="italic text-muted-foreground/50 text-5xl md:text-7xl block">De Alto Nível.</span>
              </h2>
              
              <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
                Painel OSINT redesenhado para transparência absoluta. Visualize a saúde da sua infraestrutura, status de nós globais e compliance de segurança em uma única interface táctica.
              </p>

              <div className="grid gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
                <div className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-primary" /> Monitoramento em tempo real de SLA</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-primary" /> Gestão de credenciais com AES-256</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-primary" /> Status de nodes globais (EUA, EUROPA, ÁSIA)</div>
                <div className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-primary" /> Audit log de acessos e decisões</div>
              </div>

              <Button size="lg" asChild className="h-12 px-8 text-xs font-mono uppercase tracking-widest bg-muted hover:bg-muted/80 text-foreground border border-border">
                <Link to="/auth">Ver Demo Painel</Link>
              </Button>
            </div>

            <div className="relative">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                className="rounded-2xl border border-primary/20 bg-background/50 p-1 shadow-2xl overflow-hidden"
              >
                <ProgressiveImage src={btmobDashboard} alt="BTMob Dashboard UI" className="w-full h-auto rounded-xl" />
              </motion.div>
              
              {/* Floating tactical stats */}
              <div className="absolute -bottom-6 -left-6 z-10 rounded-xl border border-border bg-background/80 p-6 backdrop-blur-md hidden md:block">
                <div className="font-mono text-[10px] text-muted-foreground uppercase mb-2">SLA Status</div>
                <div className="text-3xl font-bold text-foreground">99.98<span className="text-primary text-sm">%</span></div>
                <div className="mt-2 h-1 w-24 bg-muted rounded-full overflow-hidden">
                  <div className="h-full w-[99.98%] bg-primary" />
                </div>
              </div>
            </div>
          </div>

          {/* BTMob Reference Grid - Animated */}
          <div className="mt-24 pt-20 border-t border-border/20 relative">
            {/* Ambient glow */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 1.2 }}
              viewport={{ once: true }}
              style={{ background: "radial-gradient(ellipse 55% 55% at 50% 40%, oklch(0.78 0.13 82 / 0.10), transparent 70%)" }}
            />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <span className="font-mono text-[10px] text-primary uppercase tracking-[0.3em] inline-flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                Integrations & Modules
              </span>
              <h3 className="text-3xl md:text-4xl font-bold mt-3 tracking-tight">
                Btmob core <span className="italic text-primary">conexxion</span>
              </h3>
              <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">
                Interface real do ecossistema Shadow · sincronizada em tempo real com sua VPS
              </p>
            </motion.div>

            <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">
              {[
                { src: btmob1, alt: "BTMob Interface 1", label: "GERENCIADOR DE CLIENTES", tag: "LIVE" },
                { src: btmob2, alt: "BTMob Interface 2", label: "BTMOB ATUALIZAÇÕES", tag: "v4.6" },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 40, rotateX: -8 }}
                  whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                  whileHover={{ y: -6, scale: 1.015 }}
                  transition={{ duration: 0.7, delay: idx * 0.15, ease: [0.22, 1, 0.36, 1] }}
                  viewport={{ once: true, margin: "-50px" }}
                  className="group relative rounded-xl border border-border/50 overflow-hidden bg-background/30 p-1 shadow-[0_10px_40px_-20px_oklch(0.78_0.13_82/0.4)] hover:border-primary/40 hover:shadow-[0_20px_60px_-20px_oklch(0.78_0.13_82/0.6)] transition-all duration-500"
                  style={{ perspective: "1000px" }}
                >
                  {/* Scanline effect on hover */}
                  <div className="pointer-events-none absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 overflow-hidden rounded-xl">
                    <motion.div
                      initial={{ y: "-100%" }}
                      animate={{ y: "200%" }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-primary/10 to-transparent"
                    />
                  </div>

                  {/* Corner label */}
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-md border border-primary/30 bg-background/80 px-2 py-1 backdrop-blur-md">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="font-mono text-[8px] uppercase tracking-widest text-primary">{item.label}</span>
                  </div>
                  <div className="absolute top-3 right-3 z-10 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 backdrop-blur-md">
                    <span className="font-mono text-[8px] uppercase tracking-widest text-primary font-bold">{item.tag}</span>
                  </div>

                  <ProgressiveImage src={item.src} alt={item.alt} className="w-full h-auto transition-all duration-700 rounded-lg group-hover:scale-[1.02]" />
                </motion.div>
              ))}
            </div>

            {/* Animated chips with connecting line */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
              className="mt-12 relative flex flex-wrap justify-center gap-6 md:gap-10"
            >
              {[
                { icon: Shield, label: "Anti-Intercept" },
                { icon: Lock, label: "End-to-End" },
                { icon: Globe, label: "Global Node" },
              ].map((chip, i) => (
                <motion.div
                  key={chip.label}
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  whileHover={{ scale: 1.06, color: "oklch(0.78 0.13 82)" }}
                  transition={{ delay: 0.4 + i * 0.12, type: "spring", stiffness: 200 }}
                  viewport={{ once: true }}
                  className="flex items-center gap-2 rounded-full border border-border/50 bg-background/40 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-default backdrop-blur"
                >
                  <chip.icon className="h-3.5 w-3.5" />
                  {chip.label}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <SocialProofStrip />

      {/* Feature Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard 
              icon={ShieldCheck} 
              title="Shadow Signer" 
              desc="Assinatura digital V2/V3 com bypass nativo Play Protect. Seus APKs limpos e operacionais em segundos."
            />
            <FeatureCard 
              icon={Globe} 
              title="VPS Dedicada" 
              desc="Rede de servidores distribuídos com IP fixo e uptime de 99.9%. Velocidade e estabilidade para sua operação."
            />
            <FeatureCard 
              icon={Database} 
              title="OSINT Tools" 
              desc="Módulos avançados de busca e mineração de dados em fontes abertas. Inteligência digital na ponta dos dedos."
            />
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-20 space-y-32">
        <BeforeAfter />
        <ProofWall />
        <ImpossibleProof />
        <Testimonials />
      </div>

      {/* Final CTA */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 -z-10" />
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-6 text-foreground uppercase tracking-tight">
            Pronto para o próximo nível?
          </h2>
          <p className="text-lg text-muted-foreground/80 mb-10 max-w-xl mx-auto leading-relaxed">
            Tá esperando o quê? Entre na Shadow e opere sem deixar rastros. 
            Ativação imediata via PIX Mercado Pago.
          </p>
          <Button size="lg" asChild className="h-14 px-10 text-base rounded-full shadow-lg shadow-primary/10">
            <Link to="/planos">Adquirir Acesso Agora</Link>
          </Button>
        </div>
      </section>

      <MobileStickyCTA label="Entrar na Shadow" to="/planos" />
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="group rounded-2xl border border-border/50 bg-card p-8 transition-all hover:border-primary/30 hover:bg-card/80">
      <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mb-4 text-xl font-bold text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
