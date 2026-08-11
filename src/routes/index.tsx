// Shadow Protocol v34.0: LIVE PRODUCTION FUNCTIONAL AUDIT (dvnksmqbpbzwgwmbnjjy).
//
// Agora que a auditoria v33.0 passou, quero uma validação funcional real, não apenas validação de infraestrutura/testes.
// O fato de 9/9 testes passarem não é suficiente para considerar o sistema totalmente corrigido. 
// Quero que você faça testes reais de cada fluxo crítico no ambiente de produção atualmente conectado à Vercel.
//
// TESTES REAIS EXIGIDOS:
// 1. TESTE GRÁTIS: Confirmar ativação real, criação no Yaarsa, ausência de YAARSA_REFUSAL e limite de 24h.
// 2. FOTO DE PERFIL: Upload real, armazenamento no bucket 'avatars' e persistência pós-reload.
// 3. CENTRO DE TREINAMENTO: Abertura de cursos, marcação de progresso e persistência real.
// 4. CHAT ANÔNIMO: Envio de mensagem, recebimento no banco e propagação para outros usuários.
// 5. SHADOW PASS / VIP: Validação de missões, ganho de pontos (sem bypass) e progressão de nível.
// 6. PAINEL ADMIN: Validação de permissões (Admin, Moderator, Support) e isolamento de usuários comuns.
// 7. PERFIL: Persistência de nickname e foto no banco dvnksmqbpbzwgwmbnjjy.
// 8. INFRA: Validação final do projeto Supabase ativo na Vercel (evitar falsos positivos do Preview).
// 9. TELEMETRIA: Inspeção de erros JavaScript, HTTP 4xx/5xx e erros silenciosos do PostgREST.
//
// RELATÓRIO FINAL: ✅ Funcional | 🔧 Corrigido | ❌ Falha | ⚠️ Risco
//
// O sistema só será declarado PROD-READY se 100% dos fluxos manuais acima passarem no ambiente REAL.




import { SiteHeader } from "@/components/SiteHeader";
import { ProgressiveImage } from "@/components/ProgressiveImage";
import { siteUrl } from "@/lib/site-url";
import { useEffect } from "react";
import { useSearch, createFileRoute, Link } from "@tanstack/react-router";
import { useThemeSearchParam } from "@/hooks/use-theme-param";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { playNotifyDing } from "@/lib/notify-sound";
import { motion } from "framer-motion";
import { 
  Shield, 
  Zap, 
  Lock, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
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
        </div>
      </section>
      
      {/* Enterprise Differential Section */}
      <section className="py-20 relative bg-black/40 dark:bg-black/40">
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

      <section className="py-20 relative border-y border-border/40 bg-card/20 overflow-hidden">
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
            </div>
          </div>

          <div className="mt-24 pt-20 border-t border-border/20 relative">
            <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto px-2 md:px-0">
              <div className="relative group overflow-hidden rounded-2xl border border-primary/10">
                <ProgressiveImage src={btmob1} alt="BTMob Conexion 1" className="w-full h-auto transition-transform group-hover:scale-105" />
              </div>
              <div className="relative group overflow-hidden rounded-2xl border border-primary/10">
                <ProgressiveImage src={btmob2} alt="BTMob Conexion 2" className="w-full h-auto transition-transform group-hover:scale-105" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
