import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Activity, ArrowRight, ChevronDown, Copy, Cpu, Fingerprint, Lock, ShieldCheck, Zap, Clock } from "lucide-react";
import { useThemeSearchParam } from "@/hooks/use-theme-param";
import { useEffect, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { playNotifyDing } from "@/lib/notify-sound";
import shadowMark from "@/assets/shadow-mask.png?format=webp";
import panelOriginalAsset from "@/assets/panel-original.png.asset.json";

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
    links: [
      { rel: "canonical", href: siteUrl("/") },
      { rel: "preload", as: "image", href: shadowMark, fetchpriority: "high" },
    ],
  }),
  component: LandingPage,
  errorComponent: ({ error }: { error: Error }) => <div className="p-8 text-destructive">{error.message}</div>,
});

function DashboardPreview() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/20 p-8 md:p-12">
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <Cpu className="h-64 w-64" />
      </div>
      
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div className="space-y-8 text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary">
            <Activity className="h-3 w-3" /> Alpha-Ops Console v4.6
          </div>
          
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-foreground">
            Gestão Empresarial <br />
            <span className="text-primary italic">De Alto Nível.</span>
          </h2>
          
          <p className="max-w-md text-muted-foreground leading-relaxed">
            Painel OSINT redesenhado para transparência absoluta. Visualize a saúde da sua infraestrutura, 
            status de nós globais e compliance de segurança em uma única interface táctica.
          </p>
          
          <ul className="space-y-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
            {[
              "Monitoramento em Tempo Real de SLA",
              "Gestão de Credenciais com AES-256",
              "Status de Nodes Globais (EUA, Europa, Ásia)",
              "Audit Log de Acessos e Decisões",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <ShieldCheck className="h-3.5 w-3.5 text-neon" /> {item}
              </li>
            ))}
          </ul>
          
          <div className="flex flex-wrap gap-4 pt-4">
            <Link to="/auth">
              <Button className="h-12 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 font-mono text-[10px] uppercase tracking-widest px-8">
                Ver Demo Painel
              </Button>
            </Link>
          </div>
        </div>
        
        <div className="relative">
          {/* Dashboard UI Original - Real Image from VPS */}
          <div className="relative rounded-2xl border border-border/60 bg-background/80 shadow-2xl overflow-hidden backdrop-blur-sm group hover:scale-[1.02] transition-all duration-700">
            <div className="border-b border-border px-4 py-2 bg-[#020808] flex items-center justify-between">
              <div className="flex gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-500/50" />
                <div className="h-2 w-2 rounded-full bg-amber-500/50" />
                <div className="h-2 w-2 rounded-full bg-neon/50" />
              </div>
              <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest">
                Enterprise Dashboard • ID: 7710-AX
              </div>
            </div>
            
            <div className="relative aspect-video w-full bg-[#020808]">
              <img 
                src={panelOriginalAsset.url} 
                alt="Shadow Original Dashboard" 
                className="absolute inset-0 h-full w-full object-contain md:object-cover opacity-90 group-hover:opacity-100 transition-opacity"
              />
              
              {/* Overlay indicators to match the OSINT style */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#020808] via-transparent to-transparent opacity-60" />
              
              <div className="absolute bottom-4 left-4 font-mono text-[8px] text-neon/40 uppercase tracking-widest">
                System: Stable // Mode: Tactical
              </div>
            </div>
            
            {/* Gloss overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
          </div>
          
          {/* Floating elements */}
          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-xl flex flex-col items-center justify-center p-2 text-center animate-bounce-slow z-20">
            <Lock className="h-4 w-4 text-primary mb-1" />
            <span className="text-[8px] font-mono font-bold text-primary uppercase leading-tight">AES-256 <br />Secure</span>
          </div>
          
          <div className="absolute -bottom-10 -left-6 h-32 w-48 rounded-xl border border-neon/20 bg-neon/5 backdrop-blur-xl p-4 hidden md:block z-20">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-3 w-3 text-neon" />
              <span className="text-[9px] font-mono font-bold text-neon uppercase tracking-widest">SLA Status</span>
            </div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-2xl font-black text-neon tracking-tighter">99.98</span>
              <span className="text-[9px] font-bold text-neon/60 uppercase">%</span>
            </div>
            <div className="h-1 w-full bg-neon/10 rounded-full overflow-hidden">
              <div className="h-full bg-neon w-[99.9%]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingPage() {
  const { t } = useI18n();
  const search = useSearch({ from: "/" }) as any;

  useThemeSearchParam(search?.theme);

  useEffect(() => {
    if (search?.clear_cache === 'true') {
      const url = new URL(window.location.href);
      url.searchParams.delete('clear_cache');
      window.history.replaceState({}, '', url.toString());
      toast.success("Cache do sistema limpo com sucesso");
    }
  }, [search?.clear_cache]);


  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      
      const channel = supabase.channel(`landing-notif-${uid}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `sender_id=neq.${uid}` }, (payload: any) => {
          if (payload.new && payload.new.is_admin) {
            playNotifyDing();
          }
        })
        .subscribe();
      
      return () => { supabase.removeChannel(channel); };
    });
  }, []);

  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,var(--color-primary),transparent_50%)] opacity-[0.05]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.05] mix-blend-overlay" />
      
      <SiteHeader />
      
      <main className="relative z-10">
        <div className="mx-auto flex min-h-[90vh] max-w-5xl flex-col items-center justify-center px-6 py-20 text-center">
          {/* LCP element: rendered immediately (no opacity fade) so paint isn't delayed */}
          <div className="mb-12">
            <div className="relative inline-block h-32 w-32">
              <div className="pointer-events-none absolute inset-0 animate-pulse blur-2xl bg-primary/20" aria-hidden />
              <img
                src={shadowMark}
                alt="Shadow Mark"
                width={128}
                height={128}
                loading="eager"
                decoding="sync"
                // @ts-expect-error fetchpriority is a valid HTML attribute
                fetchpriority="high"
                className="relative mx-auto h-32 w-32 object-contain drop-shadow-[0_0_25px_var(--color-primary)]"
              />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Mirror Industries • Est. 2023</span>
          </motion.div>

          {/* LCP text: painted immediately, no opacity/scale animation */}
          <h1 className="font-display text-7xl font-extrabold tracking-[-0.04em] sm:text-9xl text-foreground mb-6">
            SHADOW
          </h1>

          <div className="mb-12 space-y-4">
            <p className="text-xl font-medium tracking-tight text-muted-foreground">
              Your shadow, <span className="text-foreground italic">everywhere.</span>
            </p>
            <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground/80">
              Infraestrutura de alta performance para monitoramento e análise de dados.
              Privacidade absoluta, velocidade máxima.
            </p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex flex-col items-center gap-8 sm:flex-row"
          >
            <Link to="/planos">
              <Button size="lg" className="h-14 rounded-full bg-primary px-10 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground hover:opacity-90 transition-all duration-500 shadow-[0_0_20px_var(--color-primary)]">
                Conhecer Planos +
              </Button>
            </Link>
            
            <Link to="/auth" className="group flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors">
              <span>Testar Acesso Por 24H —</span>
              <div className="h-px w-8 bg-border group-hover:bg-primary group-hover:w-12 transition-all" />
            </Link>
          </motion.div>
        </div>

        <div className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid grid-cols-2 gap-4 border-t border-border pt-12 opacity-40 md:grid-cols-4">
            {[
              "4.5.7 OPS READY",
              "AES-256 SECURED",
              "~24H SUPP RESPONSE",
              "RELIABLE DATA"
            ].map((stat) => (
              <div key={stat} className="text-center font-mono text-[9px] tracking-[0.3em] text-muted-foreground">
                // {stat}
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-6xl space-y-24 px-6 pb-24">
          <DashboardPreview />
          <SocialProofStrip />
          <BeforeAfter />
          <ImpossibleProof />
          <ProofWall />
          <Testimonials />
          
          {/* Final CTA Section */}
          <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-primary/5 p-12 text-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,var(--color-primary),transparent_70%)] opacity-[0.05]" />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative z-10 space-y-8"
            >
              <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl text-foreground">
                Tá esperando o quê? <br />
                <span className="text-primary italic">Entre na Shadow e opere sem deixar rastros.</span>
              </h2>
              
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link to="/planos">
                  <Button size="lg" className="h-14 w-full sm:w-auto rounded-full bg-primary px-10 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground hover:opacity-90 transition-all duration-500 shadow-[0_0_20px_var(--color-primary)]">
                    Ver Planos
                  </Button>
                </Link>
                
                <Link to="/auth">
                  <Button size="lg" variant="outline" className="h-14 w-full sm:w-auto rounded-full border-primary/20 bg-transparent px-10 font-mono text-xs uppercase tracking-[0.2em] text-primary hover:bg-primary/5 transition-all duration-500">
                    Criar Trial 24H
                  </Button>
                </Link>
              </div>
            </motion.div>
          </section>
        </div>
      </main>
      <MobileStickyCTA />
    </div>
  );
}
