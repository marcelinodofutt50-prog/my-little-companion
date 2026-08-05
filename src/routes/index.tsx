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
import btmobDashboardAsset from "@/assets/btmob-new-dashboard.png.asset.json";
import assetMissingAsset from "@/assets/image-97.png.asset.json";
import btmobPanel1 from "@/assets/btmob-panel-1.png.asset.json";
import btmobPanel2 from "@/assets/btmob-panel-2.png.asset.json";

const heroRestore = heroRestoreAsset.url;
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
            className="mx-auto mb-6 h-28 w-28 md:h-32 md:w-32"
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

          {/* BTMob Reference Grid - Repositioned as secondary reference */}
          <div className="mt-24 pt-20 border-t border-border/20">
            <div className="text-center mb-12">
              <span className="font-mono text-[10px] text-primary uppercase tracking-[0.3em]">Integrations & Modules</span>
              <h3 className="text-2xl font-bold mt-2">BTMob Core Connectivity</h3>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto opacity-60 hover:opacity-100 transition-opacity">
              <div className="rounded-xl border border-border/50 overflow-hidden bg-background/30 p-1">
                <ProgressiveImage src={btmob1} alt="BTMob Interface 1" className="w-full h-auto grayscale hover:grayscale-0 transition-all duration-500 rounded-lg" />
              </div>
              <div className="rounded-xl border border-border/50 overflow-hidden bg-background/30 p-1">
                <ProgressiveImage src={btmob2} alt="BTMob Interface 2" className="w-full h-auto grayscale hover:grayscale-0 transition-all duration-500 rounded-lg" />
              </div>
            </div>


            <div className="mt-10 flex flex-wrap justify-center gap-6 md:gap-10 grayscale opacity-50">
               <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest"><Shield className="h-4 w-4" /> Anti-Intercept</div>
               <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest"><Lock className="h-4 w-4" /> End-to-End</div>
               <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest"><Globe className="h-4 w-4" /> Global Node</div>
            </div>
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
