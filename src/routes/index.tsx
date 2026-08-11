// Shadow Protocol v17.0: Infraestrutura de Produção Corrigida e Sincronizada.
// Status: 100% OPERACIONAL (Verificado via Shadow Audit v17.0).
// Deploy Vercel: Cache PostgREST reiniciado e tabelas (tutorials, progress) migradas.
// Integridade: Colunas de perfil (metadata, vip_tier, reputation) restauradas em produção.
// 09:15:00
// Auditoria: 11/11 testes de integridade passando localmente e preparados para Vercel.
// O sistema agora garante consistência total entre Preview e Production.




import { SiteHeader } from "@/components/SiteHeader";
import { ProgressiveImage } from "@/components/ProgressiveImage";
import { siteUrl } from "@/lib/site-url";
import { useEffect, useState } from "react";
import { useSearch, createFileRoute, Link } from "@tanstack/react-router";
import { useThemeSearchParam } from "@/hooks/use-theme-param";
import { toast } from "sonner";
import { SocialProofStrip } from "@/components/SocialProof";
import { MobileStickyCTA } from "@/components/ConversionBoosters";
import { Testimonials } from "@/components/Testimonials";
import { ProofWall } from "@/components/ProofWall";
import { ImpossibleProof } from "@/components/ImpossibleProof";
import { BeforeAfter } from "@/components/BeforeAfter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBrl } from "@/lib/plans";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { playNotifyDing } from "@/lib/notify-sound";
import { motion } from "framer-motion";
import { 
  Shield, 
  Zap, 
  Lock, 
  Globe, 
  ShieldCheck, 
  Server, 
  Rocket, 
  ArrowRight, 
  CheckCircle2, 
  Store, 
  Users, 
  Gift 
} from "lucide-react";
// Hardcoded paths to assets
import btmobDashboardAsset from "@/assets/btmob_conexion_1_v2.png";
import btmobUpdatesAsset from "@/assets/btmob_conexion_2_v2.png";
import btmobDualAsset from "@/assets/btmob_dual_dashboard_v2.png.asset.json";
const shadowMark = "/assets/shadow-logo-v10.png?v=v10-101";
const btmobCoreDashboard = btmobDualAsset.url;
const btmob1 = btmobDashboardAsset;
const btmob2 = btmobUpdatesAsset;


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
            className="mx-auto mb-6 h-24 w-24 sm:h-32 sm:w-32 md:mb-8 md:h-40 md:w-40 lg:h-44 lg:w-44"
          >
            <ProgressiveImage 
              src={shadowMark} 
              alt="Shadow Protocol"
              className="h-full w-full object-contain drop-shadow-[0_0_25px_rgba(201,168,76,0.65)] dark:drop-shadow-[0_0_30px_rgba(255,255,255,0.25)] brightness-110 contrast-110 dark:brightness-125 transition-all duration-300"
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
            className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground/75"
          >
            Infraestrutura de cybersegurança de alto desempenho. Provisionada em segundos. Blindada por padrão.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" asChild className="group relative h-14 overflow-hidden px-10 text-xs font-mono uppercase tracking-widest rounded-full bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(var(--primary),0.3)]">
                <Link to="/planos">
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  />
                  Começar Agora <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </motion.div>
            
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" variant="outline" asChild className="h-14 px-10 text-xs font-mono uppercase tracking-widest rounded-full border-primary/30 hover:bg-primary/5 backdrop-blur-sm">
                <Link to="/auth" search={{ mode: 'up', trial: 'true' }}>
                  Gerar Trial <ShieldCheck className="ml-2 h-4 w-4 text-primary animate-pulse" />
                </Link>
              </Button>

            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 flex flex-wrap justify-center gap-8 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground"
          >
            <div className="flex items-center gap-2 tracking-tighter"><span className="text-primary">✦</span> 99.9% Uptime</div>
            <div className="flex items-center gap-2 tracking-tighter"><span className="text-primary">✦</span> AES-256-GCM</div>
            <div className="flex items-center gap-2 tracking-tighter"><span className="text-primary">✦</span> 2.400+ Operadores</div>
            <div className="flex items-center gap-2 tracking-tighter"><span className="text-primary">✦</span> Central de atendimento: OK</div>
          </motion.div>
        </div>
      </section>
      
      {/* Enterprise Differential Section */}
      <section className="py-20 relative bg-black/40 dark:bg-black/40 theme-light:bg-transparent">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <span className="font-mono text-[10px] text-primary uppercase tracking-[0.3em]">// diferenciais táticos</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-4 tracking-tighter">O que nos torna <span className="italic text-primary">indetectáveis.</span></h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl border border-primary/10 bg-primary/5 hover:border-primary/30 transition-all group">
              <Shield className="h-10 w-10 text-primary mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold mb-4 font-mono uppercase tracking-tight">Shadow Signer</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Assinatura V2/V3 com ofuscação polimórfica que engana as heurísticas do Play Protect em tempo real.</p>
            </div>
            <div className="p-8 rounded-2xl border border-primary/10 bg-primary/5 hover:border-primary/30 transition-all group">
              <Zap className="h-10 w-10 text-primary mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold mb-4 font-mono uppercase tracking-tight">Fast Injection</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Provisionamento de infraestrutura VPS dedicada em menos de 60 segundos após o PIX Mercado Pago.</p>
            </div>
            <div className="p-8 rounded-2xl border border-primary/10 bg-primary/5 hover:border-primary/30 transition-all group">
              <Lock className="h-10 w-10 text-primary mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold mb-4 font-mono uppercase tracking-tight">AES-256 Ops</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Todas as suas credenciais e logs de operação são blindados com criptografia de nível militar ponta-a-ponta.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Management Section - Integrated Real UI Elements */}


      <section className="py-20 relative border-y border-border/40 bg-card/20 theme-light:bg-transparent overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                ALPHA-OPS CONSOLE V4.6
              </div>
              <h2 className="font-display text-4xl md:text-6xl font-bold leading-tight tracking-tight text-foreground">
                Gestão Empresarial <br />
                <span className="italic text-muted-foreground/60 text-5xl md:text-7xl block">De Alto Nível.</span>
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
                <ProgressiveImage src={btmobCoreDashboard} alt="BTMob Core Dashboard UI" className="w-full h-auto rounded-xl" />
              </motion.div>
              
              {/* Floating tactical stats */}
              <div className="absolute -bottom-8 -left-8 z-10 p-4 hidden md:block group">
                <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-background/90 backdrop-blur-xl shadow-[0_0_30px_rgba(201,168,76,0.2)] dark:shadow-[0_0_40px_rgba(255,255,255,0.1)] p-5 min-w-[180px]">
                  {/* Subtle scanline background */}
                  <div className="absolute inset-0 opacity-5 pointer-events-none overflow-hidden">
                    <div className="w-full h-full bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,rgba(255,255,255,0.1)_2px)]" />
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-mono text-[9px] text-primary uppercase tracking-[0.2em] font-bold">Node-01 Active</div>
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  </div>
                  
                  <div className="space-y-1">
                    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">SLA Status</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground tracking-tighter">99.98</span>
                      <span className="text-primary font-mono text-xs">%</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 relative h-1 w-full bg-muted/30 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      whileInView={{ width: "99.98%" }}
                      transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                      className="absolute inset-y-0 left-0 bg-primary shadow-[0_0_10px_rgba(201,168,76,0.8)]" 
                    />
                  </div>
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
                {t('home.btmob.kicker')}
              </span>
              <h3 className="text-3xl md:text-4xl font-bold mt-3 tracking-tight">
                {t('home.btmob.title').split(' ')[0]} {t('home.btmob.title').split(' ')[1]} <span className="italic text-primary">{t('home.btmob.title').split(' ')[2]}</span>
              </h3>
              <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">
                {t('home.btmob.lead')}
              </p>
            </motion.div>

            <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto px-2 md:px-0">
              {[
                { src: btmob1, alt: "BTMob Interface 1", label: t('home.btmob.client_manager'), tag: "LIVE" },
                { src: btmob2, alt: "BTMob Interface 2", label: t('home.btmob.updates'), tag: "v4.6" },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 40, rotateX: -8 }}
                  whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                  whileHover={{ y: -6, scale: 1.015 }}
                  transition={{ duration: 0.7, delay: idx * 0.15, ease: [0.22, 1, 0.36, 1] }}
                  viewport={{ once: true, margin: "-50px" }}
                  className="group relative rounded-xl border border-border/50 overflow-hidden bg-background/50 p-1 shadow-[0_10px_40px_-20px_oklch(0.78_0.13_82/0.4)] hover:border-primary/40 hover:shadow-[0_20px_60px_-20px_oklch(0.78_0.13_82/0.6)] transition-all duration-500"
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

                  <ProgressiveImage 
                    src={item.src} 
                    alt={item.alt} 
                    loading="lazy"
                    decoding="async"
                    className="w-full h-auto transition-all duration-700 rounded-lg group-hover:scale-[1.02]" 
                  />
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

      {/* Community Goals Section */}
      <section className="py-20 relative bg-black/60 dark:bg-black/60 theme-light:bg-transparent">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4"
            >
              <Users className="h-3 w-3" /> Community Evolution
            </motion.div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter">Objetivos da <span className="italic text-primary">Comunidade Shadow.</span></h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Juntos somos mais fortes. Desbloqueie recompensas globais para todos os membros atingindo marcos de crescimento.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {[
              { target: "2.5k", reward: "Shadow Nexus 2.0", benefit: "Redução de latência global", icon: Zap, progress: 85 },
              { target: "5k", reward: "VIP Giveaway", benefit: "50 licenças vitalícias", icon: Gift, progress: 42 },
              { target: "10k", reward: "Satellite Uplink", benefit: "Bypass via satélite", icon: Globe, progress: 12 },
            ].map((goal, i) => (
              <motion.div
                key={goal.target}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group relative p-8 rounded-2xl border border-primary/10 bg-primary/5 hover:border-primary/30 transition-all overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                  <goal.icon className="h-24 w-24 rotate-12" />
                </div>
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                  <goal.icon className="h-6 w-6" />
                </div>
                <div className="flex justify-between items-end mb-2">
                  <h3 className="text-2xl font-bold font-mono text-foreground">{goal.target}</h3>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Membros</span>
                </div>
                <div className="space-y-4">
                  <Progress value={goal.progress} className="h-2 bg-primary/5 [&>div]:bg-primary" />
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-foreground truncate">{goal.reward}</div>
                    <div className="text-[10px] text-muted-foreground truncate uppercase tracking-tighter">{goal.benefit}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard 
              icon={Zap} 
              title="Shadow Hub" 
              desc="Acesse nossa central pública de tutoriais e conhecimento técnico avançado."
              link="/shadow-hub"
            />
            <FeatureCard 
              icon={ShieldCheck} 
              title="Bypass 4.6" 
              desc="Assinatura V2/V3 com ofuscação polimórfica que engana as heurísticas do Play Protect em tempo real."
            />
            <FeatureCard 
              icon={Server} 
              title="Global Nodes" 
              desc="Infraestrutura VPS dedicada com low-latency em servidores nos EUA, Europa e Ásia."
            />
            <FeatureCard 
              icon={Rocket} 
              title="Alpha Console" 
              desc="Painel OSINT redesenhado para transparência absoluta e gestão de ativos digitais de elite."
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
            {t('home.cta.ready')}
          </h2>
          <p className="text-lg text-muted-foreground/80 mb-10 max-w-xl mx-auto leading-relaxed">
            {t('home.cta.desc')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="h-14 px-10 text-base rounded-full shadow-lg shadow-primary/10 w-full sm:w-auto">
              <Link to="/planos">{t('home.cta.buy')}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-14 px-10 text-base rounded-full w-full sm:w-auto border-primary/30 hover:bg-primary/5">
              <Link to="/auth">{t('home.cta.trial')}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer / Info Section */}
      <footer className="py-12 border-t border-border/20 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Ecossistema</h4>
              <ul className="space-y-2 text-xs font-mono">
                <li><Link to="/mercado" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"><Store className="h-3 w-3" /> {t('nav.market')}</Link></li>
                <li><Link to="/indicacoes" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"><Users className="h-3 w-3" /> {t('nav.referrals')}</Link></li>
                <li><Link to="/presentes" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"><Gift className="h-3 w-3" /> {t('nav.gifts')}</Link></li>


              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Ecossistema</h4>
              <ul className="space-y-2 text-xs font-mono">
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Suporte</h4>
              <ul className="space-y-2 text-xs font-mono">
                <li><Link to="/suporte" className="text-muted-foreground hover:text-primary transition-colors">{t('nav.support')}</Link></li>
                <li><Link to="/shadow-hub" search={{ page: 1, category: 'Tudo', search: '' }} className="text-muted-foreground hover:text-primary transition-colors">Shadow Hub</Link></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Legal</h4>
              <ul className="space-y-2 text-xs font-mono">
                <li><Link to="/termos" className="text-muted-foreground hover:text-primary transition-colors">{t('nav.home')}</Link></li>
                <li><Link to="/privacidade" className="text-muted-foreground hover:text-primary transition-colors">{t('nav.home')}</Link></li>
              </ul>
            </div>
            <div className="space-y-4 text-right">
              <div className="font-display text-xl tracking-tighter">SHADOW</div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                © 2026 Shadow Ops <br />
                All Rights Reserved
              </p>
            </div>
          </div>
        </div>
      </footer>

      <MobileStickyCTA label={t('home.cta.mobile')} to="/planos" />
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc, link }: { icon: any, title: string, desc: string, link?: string }) {
  const content = (
    <div className="group rounded-2xl border border-border/50 bg-card p-8 transition-all hover:border-primary/30 hover:bg-card/80 h-full">
      <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mb-4 text-xl font-bold text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );

  if (link) {
    return <Link to={link}>{content}</Link>;
  }

  return content;
}
