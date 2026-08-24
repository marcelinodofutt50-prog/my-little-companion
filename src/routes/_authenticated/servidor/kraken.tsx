import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skull, AlertTriangle, Shield, Terminal, Zap, Activity, Volume2, VolumeX, RefreshCw, Sliders, Sparkles, ArrowLeft } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { useServerFn } from "@tanstack/react-start"
import { createCheckout } from "@/lib/checkout.functions"
import { krakenCommand, type KrakenOutput } from "@/lib/kraken.functions"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { getKrakenStatus } from "@/lib/kraken-status.functions"
import { cn } from "@/lib/utils"

import krakenV32Asset from "@/assets/kraken_fundo_v32.png";

// Imagem tática central da Kraken 2.0
// v32: Atualizando para a arte bioluminescente v32 enviada pelo usuário via GitHub.
const KRAKEN_BG_CANDIDATES: string[] = [
  krakenV32Asset,
].filter(Boolean) as string[];

const KRAKEN_BG_FALLBACK = KRAKEN_BG_CANDIDATES[0];

const getUrlWithBust = (url: string) => {
  if (!url) return "";
  const sep = url.includes("?") ? "&" : "?";
  // v32: Auditoria de cache Vercel - Forçando atualização do asset bioluminescente v32
  return `${url}${sep}v=32_final`;
};

const krakenCore = getUrlWithBust(krakenV32Asset || KRAKEN_BG_FALLBACK);






export const Route = createFileRoute('/_authenticated/servidor/kraken')({
  head: () => ({
    meta: [
      { title: "Kraken 2.0 — Unidade Tática de Injeção" },
      { name: "description", content: "Painel de controle da Kraken 2.0: status de licença, comandos táticos e diagnóstico em tempo real." },
      { property: "og:title", content: "Kraken 2.0 — Unidade Tática de Injeção" },
      { property: "og:description", content: "Painel de controle da Kraken 2.0 com status de licença e comandos táticos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      // Preload da imagem de fundo para eliminar flicker no primeiro paint
      { rel: "preload", as: "image", href: krakenCore, fetchPriority: "high" },
    ],
  }),
  component: KrakenRouteComponent,
});

function KrakenRouteComponent() {
  const [resolvedBg, setResolvedBg] = useState<string>(krakenCore);
  const [bgLoaded, setBgLoaded] = useState({ core: false, bg5: false });

  console.log("[Kraken] Renderizando componente de rota...");
  return (
    <div className="min-h-screen bg-background overflow-x-hidden theme-transition relative">
      <div 
        className="fixed inset-0 z-0 pointer-events-none w-full h-full overflow-hidden bg-black kraken-bg-container"
        style={{ 
          backgroundImage: `url('${resolvedBg}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          filter: 'brightness(0.9) contrast(1.1) saturate(1.1)',
          backgroundColor: 'black'
        }}
      >
          {/* Tactical Background Overlay - Base safety layer */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-950 via-slate-950 to-black opacity-100 z-[-2] block" />
          
          {/* Skeleton Placeholder */}
          <div
            aria-hidden="true"
            className={cn(
              "absolute inset-0 transition-opacity duration-700",
              bgLoaded.core ? "opacity-0" : "opacity-100"
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950/60 to-black" />
            <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_35%,rgba(59,130,246,0.14)_50%,transparent_65%)] bg-[length:200%_100%] animate-[shimmer_2.2s_linear_infinite]" />
          </div>

          {/* Tactical Overlays */}
          <div className="absolute inset-0 bg-blue-500/5 mix-blend-overlay pointer-events-none z-[1]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.1)_0%,_transparent_80%)] pointer-events-none z-[2]" />
          <div className="absolute inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.4)] pointer-events-none z-[3]" />
        </div>
        
        <ErrorBoundary name="KrakenPage">
          <KrakenPage 
            resolvedBg={resolvedBg} 
            setResolvedBg={setResolvedBg}
            bgLoaded={bgLoaded}
            setBgLoaded={setBgLoaded}
          />
        </ErrorBoundary>
      </div>
    );
}

interface KrakenPageProps {
  resolvedBg: string;
  setResolvedBg: (url: string) => void;
  bgLoaded: { core: boolean; bg5: boolean };
  setBgLoaded: (val: any) => void;
}

function KrakenPage({ resolvedBg, setResolvedBg, bgLoaded, setBgLoaded }: KrakenPageProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [command, setCommand] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioDelay, setAudioDelay] = useState(0);
  const [bgLoadError, setBgLoadError] = useState(false);


  const logEndRef = useRef<HTMLDivElement>(null);
  const executeKraken = useServerFn(krakenCommand);
  const checkoutFn = useServerFn(createCheckout);
  const fetchStatus = useServerFn(getKrakenStatus);

  const { data: krakenStatus, refetch: refetchStatus, isRefetching } = useQuery({
    queryKey: ['kraken-status'],
    queryFn: () => fetchStatus({ data: { metadata: { route: window.location.pathname } } }),
    refetchInterval: 30000, // Sync every 30s
  });

  useEffect(() => {
    let cancelled = false;
    console.log("[Kraken] Iniciando diagnóstico de carregamento...");

    /**
     * Valida cada candidato da cadeia: descarta 404 / erro de rede e também
     * assets com proporção incompatível (ex.: recortes estreitos salvos por engano).
     */
    const validateCandidate = (url: string) =>
      new Promise<boolean>((resolve) => {
        const img = new Image();
        const finish = (ok: boolean) => resolve(ok);
        img.onload = () => {
          const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
          const isUsable = img.naturalWidth >= 400 && ratio >= 0.5 && ratio <= 4.0;
          if (!isUsable) {
            console.warn(
              `[Kraken] Asset descartado (proporção inválida ${img.naturalWidth}x${img.naturalHeight} | ratio: ${ratio.toFixed(2)}): ${url}`
            );
          } else {
            console.log(`[Kraken] Asset validado com sucesso (${img.naturalWidth}x${img.naturalHeight}): ${url}`);
          }
          finish(isUsable);
        };
        img.onerror = () => {
          console.warn(`[Kraken] Asset indisponível (404/erro de rede): ${url}`);
          finish(false);
        };
        img.src = url;
      });

    const resolveBackground = async () => {
      for (const candidate of KRAKEN_BG_CANDIDATES) {
        if (cancelled) return;
        const ok = await validateCandidate(candidate);
        if (cancelled) return;
        if (ok) {
          setResolvedBg(getUrlWithBust(candidate));
          setBgLoaded((prev: any) => ({ ...prev, core: true }));
          setBgLoadError(false);
          console.log(`[Kraken] Fundo resolvido: ${candidate}`);
          return;
        }
      }
      // Nenhum candidato válido: mantém o gradiente tático como fundo definitivo
      console.error("[Kraken] Nenhum asset de fundo válido. Usando fallback CSS.");
      setBgLoadError(true);
      setBgLoaded((prev: any) => ({ ...prev, core: false }));
      
      // Fallback manual se a validação falhar: tenta forçar o primeiro candidato sem validação de proporção
      if (KRAKEN_BG_CANDIDATES.length > 0) {
        console.warn("[Kraken] Tentando carregamento de emergência sem validação estrita...");
        const emergencyUrl = getUrlWithBust(KRAKEN_BG_CANDIDATES[0]);
        setResolvedBg(emergencyUrl);
        setBgLoaded((prev: any) => ({ ...prev, core: true }));
        // Força o carregamento no DOM
        const preloader = new Image();
        preloader.src = emergencyUrl;
      }
    };

    resolveBackground();


    const timer = setTimeout(() => setShowEffects(true), 500);
    

    
    // Motor de áudio 100% local (sintetizado) — sem dependência externa/CORS
    let audioContext: AudioContext | null = null;
    let audioBuffer: AudioBuffer | null = null;

    const synthesizeThunder = (ctx: AudioContext) => {
      const duration = 2.6;
      const rate = ctx.sampleRate;
      const buffer = ctx.createBuffer(2, Math.floor(rate * duration), rate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        let low = 0;
        for (let i = 0; i < data.length; i++) {
          const t = i / rate;
          const white = Math.random() * 2 - 1;
          // filtro passa-baixa simples => rumble grave
          low = low + 0.02 * (white - low);
          const crack = Math.exp(-t * 9) * white * 0.35;
          const rumble = Math.exp(-t * 1.5) * low * 6;
          data[i] = Math.max(-1, Math.min(1, crack + rumble));
        }
      }
      return buffer;
    };

    const initAudio = async () => {
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioBuffer = synthesizeThunder(audioContext);
      } catch (e) {
        console.error("Falha ao inicializar o motor de áudio:", e);
      }
    };

    initAudio();

    const playThunderEffect = () => {
      if (!showEffects || isMuted || !audioBuffer || !audioContext) return;
      
      // Se o contexto estiver suspenso (restrição de autoplay), tentamos retomar
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(console.error);
        // Mesmo se retomar agora, a primeira execução pode falhar se não houver interação prévia,
        // mas as subsequentes funcionarão assim que o usuário clicar em qualquer lugar.
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.5 + Math.random() * 0.5;
      
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      source.start(0);
    };


    // Lightning simulation (audio only, visual flashes removed per user request)
    const lightningInterval = setInterval(() => {
      if (showEffects) {
        // Dispara entre 8 e 15 segundos
        const delay = 8000 + Math.random() * 7000;
        
        setTimeout(() => {
          if (audioDelay === 0) {
            playThunderEffect();
          } else {
            setTimeout(playThunderEffect, Math.max(0, audioDelay));
          }
        }, delay);
      }
    }, 15000);

    // Handler para desbloquear o áudio na primeira interação do usuário
    const unlockAudio = () => {
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log("AudioContext retomado após interação do usuário.");
          window.removeEventListener('click', unlockAudio);
          window.removeEventListener('keydown', unlockAudio);
          window.removeEventListener('touchstart', unlockAudio);
        });
      }
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    
    return () => {
      cancelled = true;
      clearTimeout(timer);

      clearInterval(lightningInterval);
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      if (audioContext) audioContext.close();
    };
  }, [isMuted, showEffects, audioDelay]);


  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isExecuting) return;

    const cmd = command.trim();
    setCommand("");
    setLogs(prev => [...prev, `> ${cmd}`]);
    setIsExecuting(true);

    try {
      const res = await executeKraken({ data: { command: cmd, metadata: { route: window.location.pathname } } as any });
      
      // Handle the response properly based on its structure
      const success = (res as any)?.success ?? false;
      const message = (res as any)?.message ?? "Comando processado.";

      setLogs(prev => [...prev, `[KRAKEN] ${message}`]);
      
      if (success) {
        toast.success("Comando Kraken executado");
      } else {
        toast.error(message || "Erro na execução do comando");
      }
    } catch (err: any) {
      const errorMsg = err.message || "Falha na comunicação com o Kraken";
      setLogs(prev => [...prev, `[ERROR] ${errorMsg}`]);
      toast.error(errorMsg);
    } finally {
      setIsExecuting(false);
    }
  };

  console.log("[Kraken] Renderizando componente...");
  return (
    <div id="kraken-viewport-root" className="relative z-10 flex-1 space-y-6 p-4 md:p-8 pt-6 bg-transparent min-h-screen theme-transition flex flex-col items-center justify-start text-foreground w-full max-w-full overflow-hidden">
      {/* Container background removed from here to be placed at the root level for proper z-index and filling */}


      {/* Navigation back to Dashboard */}
      <div className="absolute top-4 right-4 z-50">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="font-mono text-[10px] uppercase tracking-widest border-red-900/40 bg-black/70 backdrop-blur-md hover:bg-red-500/10 hover:text-red-500"
        >
          <Link to="/dashboard">
            <ArrowLeft className="h-3 w-3 mr-2" /> Voltar ao Dashboard
          </Link>
        </Button>
      </div>

      <div className="relative z-20 space-y-6 w-full max-w-7xl px-4 md:px-0">
        <div className="flex items-center justify-between space-y-2">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="kraken-fade-in"
          >
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter rgb-text animate-rgb-text uppercase italic drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
              Kraken 2.0
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground font-mono text-xs uppercase tracking-[0.3em]">
                // correções na kraken
              </p>
            </div>
          </motion.div>
          
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              <span className="font-mono text-[10px] text-red-500 font-bold uppercase tracking-tighter">Live Connection</span>
            </div>
            <span className="text-[9px] font-mono text-foreground/40 dark:text-white/40">NODE_ID: 0xFA-88</span>
          </div>
        </div>

        {/* User Status Bar */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-3 border-white/20 bg-black/80 dark:bg-black/90 backdrop-blur-3xl px-6 py-3 flex items-center justify-between kraken-fade-in border-l-4 border-l-blue-500 shadow-lg shadow-blue-500/10 transition-all duration-500">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[8px] font-mono text-foreground/40 dark:text-white/40 uppercase tracking-widest">Status da Licença</span>
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", krakenStatus?.active ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                  <span className={cn("text-xs font-mono font-bold uppercase", krakenStatus?.active ? "text-emerald-500" : "text-red-500")}>
                    {krakenStatus?.active ? "Kraken 2.0 Ativa" : "Licença Inativa"}
                  </span>
                </div>
              </div>
              
              {krakenStatus?.license && (
                <div className="h-8 w-px bg-foreground/5 dark:bg-white/5 hidden sm:block" />
              )}
              
              {krakenStatus?.license && (
                <div className="flex flex-col hidden sm:flex">
                  <span className="text-[8px] font-mono text-foreground/40 dark:text-white/40 uppercase tracking-widest">Expiração</span>
                  <span className="text-xs font-mono text-foreground/80 dark:text-white/80">
                    {new Date(krakenStatus.license.expires_at || "").toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}

              {krakenStatus?.lastOrder && krakenStatus.lastOrder.status === 'processing' && (
                <div className="flex items-center gap-2 px-3 py-1 rounded bg-amber-500/10 border border-amber-500/20 animate-pulse">
                  <RefreshCw className="h-3 w-3 text-amber-500 animate-spin" />
                  <span className="text-[10px] font-mono text-amber-500 uppercase font-bold">Pagamento em processamento</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-3 text-[9px] font-mono uppercase text-foreground/40 dark:text-white/40 hover:text-foreground dark:hover:text-white border border-foreground/5 dark:border-white/5 hover:bg-foreground/5 dark:hover:bg-white/5"
                onClick={() => {
                  setBgLoaded({ core: false, bg5: false });
                  refetchStatus();
                }}
              >
                <RefreshCw className={cn("h-3 w-3 mr-2", (isRefetching || Object.values(bgLoaded).some(v => !v)) && "animate-spin-slow")} />
                Sync & Diagnostics
              </Button>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <Card className="lg:col-span-4 border-white/20 bg-black/80 dark:bg-black/90 backdrop-blur-3xl shadow-2xl shadow-blue-900/20 kraken-fade-in flex flex-col items-center justify-center p-8 text-center min-h-[550px] relative overflow-hidden group transition-colors duration-500">
            <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="w-full max-w-2xl mb-8 relative z-10 aspect-video rounded-lg overflow-hidden border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <iframe 
                width="100%" 
                height="100%" 
                src="https://www.youtube.com/embed/XgIQPCXVaY8" 
                title="Kraken (2.0) Review" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                allowFullScreen
                className="opacity-80 hover:opacity-100 transition-opacity"
              ></iframe>
            </div>

            <CardTitle className="text-3xl font-black font-mono uppercase tracking-[0.4em] text-red-500 mb-4 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">
              KRAKEN 2.0
            </CardTitle>
            
            <div className="max-w-md space-y-4">
              <p className="text-sm text-white font-medium uppercase tracking-wider leading-relaxed">
                Revisão Tática de Campo (2.0)
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
              <div className="p-4 rounded-lg border border-red-500/20 bg-black/60 backdrop-blur-sm group/item hover:border-red-500/50 transition-all">

                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-red-500" />
                  <div className="text-[10px] text-red-400 font-mono uppercase font-bold">Protocolo Stealth</div>
                </div>
                <div className="text-[11px] text-foreground/90 dark:text-white/90 text-left font-mono">Bypass nativo indetectável por algoritmos heurísticos de IA.</div>
              </div>
              <div className="p-4 rounded-lg border border-red-500/20 bg-black/60 backdrop-blur-sm group/item hover:border-red-500/50 transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <div className="text-[10px] text-amber-400 font-mono uppercase font-bold">Kraken Dropper</div>
                </div>
                <div className="text-[11px] text-white/90 text-left font-mono">Injeção em tempo real com ofuscação polimórfica dinâmica.</div>
              </div>
              <div className="p-4 rounded-lg border border-red-500/20 bg-black/40 backdrop-blur-sm group/item hover:border-red-500/50 transition-all">

                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  <div className="text-[10px] text-emerald-400 font-mono uppercase font-bold">Multi-Node Hub</div>
                </div>
                <div className="text-[11px] text-white/90 text-left font-mono">Controle centralizado para Nubank, Caixa e Itaú simultâneos.</div>
              </div>
              <div className="p-4 rounded-lg border border-red-500/20 bg-black/40 backdrop-blur-sm group/item hover:border-red-500/50 transition-all">

                <div className="flex items-center gap-2 mb-1">
                  <Terminal className="h-4 w-4 text-blue-500" />
                  <div className="text-[10px] text-blue-400 font-mono uppercase font-bold">Custom black-screen</div>
                </div>
                <div className="text-[11px] text-white/90 text-left font-mono">Criação de telas de engenharia social 100% customizáveis.</div>
              </div>
            </div>
          </Card>

          <div className="lg:col-span-3 space-y-6">
            <Card className="border-amber-900/30 bg-black/70 backdrop-blur-md kraken-fade-in" style={{ transitionDelay: '0.2s' }}>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="rounded-full bg-amber-500/10 p-2 border border-amber-500/20">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-sm font-mono uppercase tracking-widest text-amber-500">Security Protocol</CardTitle>
                  <p className="text-[10px] text-muted-foreground uppercase">Encryption & Node Metrics</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1 group hover:border-emerald-500/30 transition-colors">
                    <div className="text-[9px] text-muted-foreground uppercase font-mono">Encryption</div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-3 w-3 text-emerald-500" />
                      <span className="text-[10px] font-mono font-bold">AES-256-XTS</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-1 group hover:border-amber-500/30 transition-colors">
                    <div className="text-[9px] text-muted-foreground uppercase font-mono">Throughput</div>
                    <div className="flex items-center gap-2">
                      <Activity className="h-3 w-3 text-amber-500" />
                      <span className="text-[10px] font-mono font-bold">1.2 GB/s</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-red-500/20 bg-black/60 p-4 space-y-2 border-l-4 border-l-red-500">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-red-400 font-bold">INTEL: EXCLUSIVE ASSET</span>
                    <div className="flex gap-1">
                      <div className="h-1 w-3 bg-red-500 rounded-full animate-pulse" />
                    </div>
                  </div>
                  <p className="text-[11px] text-white/70 leading-relaxed font-medium italic">
                    "A Kraken não é apenas uma ferramenta; é uma entidade. O futuro da KL chegou."
                  </p>

                  <div className="pt-4 border-t border-red-500/10 mt-2 space-y-4">
                    <p className="text-[9px] text-muted-foreground uppercase font-mono">Select Plan:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                      <Button
                        className="group relative h-20 overflow-hidden rounded-xl border border-neon/30 bg-black/60 hover:bg-neon/10 transition-all duration-500 flex flex-col items-center justify-center"
                        onClick={async () => {
                          try {
                            const r = await checkoutFn({ data: {
                              planSlug: 'kraken-monthly',
                              returnOrigin: window.location.origin
                            }});
                            window.location.href = r.checkoutUrl;
                          } catch (err: any) {
                            toast.error(err.message || "Erro ao iniciar checkout");
                          }
                        }}
                        aria-label="Adquirir Plano Mensal Kraken por 20 mil reais com pagamento seguro"
                      >
                        <span className="text-[10px] text-neon font-bold tracking-widest uppercase">MENSAL</span>
                        <span className="text-xl font-black text-white group-hover:scale-110 transition-transform">R$ 20.000</span>
                        <span className="text-[9px] text-neon/80 uppercase mt-1 font-medium">Checkout Mensal</span>
                      </Button>

                      <Button
                        className="group relative h-20 overflow-hidden rounded-xl border border-emerald-500/30 bg-black/60 hover:bg-emerald-500/10 transition-all duration-500 flex flex-col items-center justify-center"
                        onClick={async () => {
                          try {
                            const r = await checkoutFn({ data: {
                              planSlug: 'kraken-lifetime',
                              returnOrigin: window.location.origin
                            }});
                            window.location.href = r.checkoutUrl;
                          } catch (err: any) {
                            toast.error(err.message || "Erro ao iniciar checkout");
                          }
                        }}
                        aria-label="Adquirir Plano Vitalício Kraken por 30 mil reais com pagamento seguro"
                      >
                        <span className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase">VITALÍCIO</span>
                        <span className="text-xl font-black text-white group-hover:scale-110 transition-transform">R$ 30.000</span>
                        <span className="text-[9px] text-emerald-200/80 uppercase mt-1 font-medium">Checkout Vitalício</span>
                      </Button>
                    </div>

                  </div>

                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-900/30 bg-black/80 dark:bg-black/90 backdrop-blur-3xl kraken-fade-in transition-colors duration-500" style={{ transitionDelay: '0.4s' }}>
               <CardHeader className="pb-2">
                 <CardTitle className="text-[10px] font-mono uppercase tracking-[0.2em] text-blue-400">Tactical Shortcuts</CardTitle>
               </CardHeader>
               <CardContent className="grid grid-cols-2 gap-2">
                  {["Reboot Node", "Sync Keys", "Flush Cache", "Auto-Inject"].map(act => (
                    <Button 
                      key={act} 
                      variant="outline" 
                      size="sm"
                      className="text-[9px] font-mono uppercase border-blue-900/20 bg-blue-900/10 hover:bg-blue-600 hover:text-white transition-all duration-300"
                      onClick={() => setCommand(act.toLowerCase().replace(" ", "-"))}
                    >
                      {act}
                    </Button>
                  ))}
               </CardContent>
            </Card>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="p-4 rounded border border-red-500/20 bg-black/80 dark:bg-black/90 backdrop-blur-3xl text-[10px] text-white/80 font-mono space-y-2 transition-colors duration-500"
            >
              <div className="font-bold text-red-400 uppercase tracking-widest border-b border-red-500/20 pb-2 mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Diferenciais de Elite:
              </div>
              <ul className="grid grid-cols-1 gap-3">
                {[
                  { t: "Bypass Heurístico IA", d: "Supera as novas detecções automáticas que a Btmob não alcança." },
                  { t: "Dropper Polimórfico", d: "O código do APK muda a cada build, impossibilitando assinaturas de antivírus." },
                  { t: "Painel Multi-alvo", d: "Interface otimizada para gerenciar múltiplos bancos em uma única tela." },
                  { t: "Instalação Stealth", d: "Processo de infecção 70% mais rápido e com menos alertas de sistema." }
                ].map((item, idx) => (
                  <li key={idx} className="flex gap-3 items-start border-l border-red-500/10 pl-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <div>
                      <div className="text-white font-bold uppercase tracking-tighter text-[11px]">{item.t}</div>
                      <div className="text-white/50 text-[10px] leading-tight mt-0.5">{item.d}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[9px] text-muted-foreground italic border-t border-white/5 pt-2">
                [NOTE] Ticket de prioridade máxima automático após aquisição.
              </p>
            </motion.div>

          </div>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.5);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, var(--neon), var(--cyan), var(--violet));
          border-radius: 10px;
        }
      `}</style>
    </div>
  )
}
