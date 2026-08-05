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
import shadowMark from "@/assets/shadow-mask.png?format=webp";

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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary"
          >
            <Terminal className="h-3 w-3" />
            System Live · Shadow Protocol v4.6
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-8 font-display text-5xl font-bold leading-[0.9] tracking-tighter md:text-8xl lg:text-9xl"
          >
            OPERE NAS<br />
            <span className="text-primary italic">SOMBRAS.</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl"
          >
            A elite do gerenciamento de ativos digitais e bypass de segurança. 
            Shadow Signer, Droppers indetectáveis e infraestrutura de rede blindada.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-12 flex flex-wrap justify-center gap-4"
          >
            <Button size="lg" asChild className="h-14 px-10 text-base">
              <Link to="/planos">
                Entrar na Shadow <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-14 px-10 text-base">
              <Link to="/auth">Criar Conta Grátis</Link>
            </Button>
          </motion.div>
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

      <BeforeAfter />
      <ProofWall />
      <ImpossibleProof />
      <Testimonials />

      {/* Final CTA */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 -z-10" />
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-8">
            PRONTO PARA O PRÓXIMO NÍVEL?
          </h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Tá esperando o quê? Entre na Shadow e opere sem deixar rastros. 
            Ativação imediata via PIX Mercado Pago.
          </p>
          <Button size="lg" asChild className="h-16 px-12 text-lg rounded-full">
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
      <h3 className="mb-4 text-xl font-bold">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
