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
import panelFixedAsset from "@/assets/btmob-panel-1.png.asset.json";
import panelFixed2Asset from "@/assets/btmob-panel-2.png.asset.json";
const panelFixed = panelFixedAsset.url;
const panelFixed2 = panelFixed2Asset.url;

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
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-28">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 12, stiffness: 200 }}
            className="mx-auto mb-10 h-32 w-32 md:h-40 md:w-40"
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
            className="mt-8 font-display text-5xl font-bold leading-[0.9] tracking-tighter md:text-7xl lg:text-9xl text-foreground"
          >
            SHADOW
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-8 max-w-2xl text-lg font-medium text-muted-foreground md:text-xl"
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
            className="mt-12 flex flex-wrap items-center justify-center gap-6"
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
            className="mt-20 flex flex-wrap justify-center gap-8 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/40"
          >
            <div className="flex items-center gap-2 tracking-tighter"><span className="text-primary">✦</span> 99.9% Uptime</div>
            <div className="flex items-center gap-2 tracking-tighter"><span className="text-primary">✦</span> AES-256-GCM</div>
            <div className="flex items-center gap-2 tracking-tighter"><span className="text-primary">✦</span> 2.400+ Operadores</div>
            <div className="flex items-center gap-2 tracking-tighter"><span className="text-primary">✦</span> Suporte 24/7</div>
          </motion.div>
        </div>
      </section>

      {/* Hero Image / Original Panel */}
      <section className="py-20 relative overflow-hidden border-y border-border/40 bg-card/20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-4xl rounded-3xl border border-primary/20 bg-background/50 p-2 shadow-[0_0_80px_-20px_oklch(0.78_0.13_82/0.2)] overflow-hidden"
          >
            <ProgressiveImage 
              src={panelFixed} 
              alt="Shadow Manager Interface" 
              className="w-full h-auto rounded-2xl grayscale hover:grayscale-0 transition-all duration-1000"
            />
          </motion.div>
          <div className="mt-10 flex justify-center gap-10 grayscale opacity-50">
             <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest"><Shield className="h-4 w-4" /> Anti-Intercept</div>
             <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest"><Lock className="h-4 w-4" /> End-to-End</div>
             <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest"><Globe className="h-4 w-4" /> Global Node</div>
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
      <section className="py-32 relative overflow-hidden">
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
