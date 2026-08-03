import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Activity, ArrowRight, ChevronDown, Copy, Cpu, Fingerprint, Lock, ShieldCheck, Zap, Clock } from "lucide-react";
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
    links: [
      { rel: "canonical", href: siteUrl("/") },
      { rel: "preload", as: "image", href: shadowMark, fetchpriority: "high" },
    ],
  }),
  component: LandingPage,
  errorComponent: ({ error }: { error: Error }) => <div className="p-8 text-destructive">{error.message}</div>,
});

function LandingPage() {
  const { t } = useI18n();
  const search = useSearch({ from: "/" }) as any;

  useEffect(() => {
    const html = document.documentElement;
    const isLight = search?.theme === 'light';
    
    // Check for explicit cache clearing request
    if (search?.clear_cache === 'true') {
      const url = new URL(window.location.href);
      url.searchParams.delete('clear_cache');
      window.history.replaceState({}, '', url.toString());
      toast.success("Cache do sistema limpo com sucesso");
    }

    if (isLight) {
      html.classList.add('theme-light');
      html.classList.remove('dark');
      html.style.colorScheme = 'light';
    } else {
      html.classList.remove('theme-light');
      html.classList.add('dark');
      html.style.colorScheme = 'dark';
    }
  }, [search?.theme, search?.clear_cache]);


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
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-12"
          >
            <div className="relative inline-block">
              <div className="absolute inset-0 animate-pulse blur-2xl bg-primary/20" />
              <img src={shadowMark} alt="Shadow Mask" className="relative mx-auto h-32 w-32 object-contain drop-shadow-[0_0_25px_var(--color-primary)]" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Mirror Industries • Est. 2023</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="font-display text-7xl font-extrabold tracking-[-0.04em] sm:text-9xl text-foreground mb-6"
          >
            SHADOW
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="mb-12 space-y-4"
          >
            <p className="text-xl font-medium tracking-tight text-muted-foreground">
              Your shadow, <span className="text-foreground italic">everywhere.</span>
            </p>
            <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground/80">
              Infraestrutura de alta performance para monitoramento e análise de dados.
              Privacidade absoluta, velocidade máxima.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex flex-col items-center gap-8 sm:flex-row"
          >
            <Link to="/planos" search={{ theme: search?.theme }}>
              <Button size="lg" className="h-14 rounded-full bg-primary px-10 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground hover:opacity-90 transition-all duration-500 shadow-[0_0_20px_var(--color-primary)]">
                Conhecer Planos +
              </Button>
            </Link>
            
            <Link to="/auth" search={{ theme: search?.theme }} className="group flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors">
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
          <SocialProofStrip />
          <BeforeAfter />
          <ImpossibleProof />
          <ProofWall />
          <Testimonials />
        </div>
      </main>
      <MobileStickyCTA />
    </div>
  );
}
