import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skull, AlertTriangle, Shield, Terminal, Zap, Activity, Volume2, VolumeX, RefreshCw, Sliders, Sparkles } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { useServerFn } from "@tanstack/react-start"

import { krakenCommand, type KrakenOutput } from "@/lib/kraken.functions"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import krakenBg4 from "@/assets/kraken-bg-4.png.asset.json"
import krakenBg5 from "@/assets/kraken-bg-5.png.asset.json"

export const Route = createFileRoute('/_authenticated/servidor/kraken')({
  component: KrakenPage,
})

function KrakenPage() {
  const [logs, setLogs] = useState<string[]>([
    "[SYSTEM] Initializing Kraken environment...",
    "[SYSTEM] Checking hardware acceleration...",
    "[SYSTEM] Node 0xFA-88 synchronized.",
    "[SYSTEM] Ready for operator commands."
  ]);
  const [command, setCommand] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [isMuted, setIsMuted] = useState(false); // Áudio ativo por padrão para validação imediata
  const [intensity, setIntensity] = useState(1);
  const [audioDelay, setAudioDelay] = useState(0);
  const [bgLoadError, setBgLoadError] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);
  const executeKraken = useServerFn(krakenCommand);

  useEffect(() => {
    const timer = setTimeout(() => setShowEffects(true), 500);
    
    // Web Audio API context para reprodução mais robusta
    let audioContext: AudioContext | null = null;
    let audioBuffer: AudioBuffer | null = null;
    const audioUrl = "https://www.soundjay.com/nature/thunder-01.mp3";

    const initAudio = async () => {
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const response = await fetch(audioUrl);
        const data = await response.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(data);
        console.log("Áudio de trovão carregado e pronto.");
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

    const lightningInterval = setInterval(() => {
      if (showEffects) {
        // Toggle intensity slightly to force DOM recalculation
        setIntensity(prev => prev === 1 ? 0.99 : 1);
        
        if (audioDelay === 0) {
          playThunderEffect();
        } else {
          setTimeout(playThunderEffect, Math.max(0, audioDelay));
        }
      }
    }, 4000);

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
      const res = (await executeKraken({ data: { command: cmd } })) as KrakenOutput;
      
      if (!res || typeof res.success === 'undefined') {
        throw new Error("Resposta inválida do servidor");
      }

      setLogs(prev => [...prev, `[KRAKEN] ${res.message || "Comando processado."}`]);
      
      if (res.success) {
        toast.success("Comando Kraken executado");
      } else {
        toast.error(res.message || "Erro na execução do comando");
      }
    } catch (err: any) {
      const errorMsg = err.message || "Falha na comunicação com o Kraken";
      setLogs(prev => [...prev, `[ERROR] ${errorMsg}`]);
      toast.error(errorMsg);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="relative flex-1 space-y-6 p-4 md:p-8 pt-6 bg-black min-h-screen overflow-hidden">
      {/* Background Images with Fade */}
      <AnimatePresence>
        {showEffects && !bgLoadError && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
              style={{ 
                backgroundImage: `url(${krakenBg4.url})`, 
                backgroundSize: 'cover', 
                backgroundPosition: 'center',
                zIndex: 0
              }}
              onError={() => setBgLoadError(true)}
            />
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ delay: 1 }}
              className="absolute inset-0 pointer-events-none mix-blend-overlay transition-opacity duration-1000"
              style={{ 
                backgroundImage: `url(${krakenBg5.url})`, 
                backgroundSize: 'cover', 
                backgroundPosition: 'center',
                zIndex: 1
              }}
              onError={() => setBgLoadError(true)}
            />
          </>
        )}
        {showEffects && bgLoadError && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            className="absolute inset-0 pointer-events-none bg-gradient-to-br from-red-950/40 via-black to-black z-0"
          />
        )}
      </AnimatePresence>

      {showEffects && (
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          {/* Main Lightning Strike */}
          <div 
            className="animate-lightning" 
            style={{ 
              '--lightning-opacity': intensity,
              background: bgLoadError ? 'rgba(255,255,255,0.05)' : undefined,
              animation: 'lightning-strike 4s infinite both'
            } as React.CSSProperties}
          />
          
          {/* Global Screen Flash */}
          <div 
            className="absolute inset-0 bg-white/20 opacity-0 mix-blend-overlay pointer-events-none"
            style={{ 
              animation: 'lightning-strike 5s infinite',
              animationDelay: '0.05s'
            }}
          />
        </div>
      )}



      {/* Settings Panel Overlay */}
      <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-3">
        <div className="flex flex-col gap-3 bg-black/80 backdrop-blur-xl border border-red-900/30 p-4 rounded-xl shadow-2xl shadow-red-900/20 w-64 kraken-fade-in">
          <div className="flex items-center justify-between border-b border-red-900/20 pb-2 mb-2">
            <span className="text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest">System Params</span>
            <div className="flex items-center gap-1">
              <div className="h-1 w-1 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[8px] font-mono text-white/40 uppercase">Ajuste tático</span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Intensity Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-3 w-3 text-amber-500" />
                  <span className="text-[10px] font-mono text-white/60 uppercase">Raios (Intensity)</span>
                </div>
                <span className="text-[10px] font-mono text-white/40">{Math.round(intensity * 100)}%</span>
              </div>
              <Slider 
                value={[intensity * 100]} 
                min={0} 
                max={100} 
                step={1} 
                onValueChange={(val) => setIntensity(val[0] / 100)}
                className="cursor-pointer"
              />
            </div>

            {/* Audio Delay Calibration */}
            <div className="space-y-2 pt-2 border-t border-red-900/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-3 w-3 text-emerald-500" />
                  <span className="text-[10px] font-mono text-white/60 uppercase">Audio Sync (Delay)</span>
                </div>
                <span className="text-[10px] font-mono text-white/40">{audioDelay}ms</span>
              </div>
              <Slider 
                value={[audioDelay]} 
                min={-500} 
                max={500} 
                step={10} 
                onValueChange={(val) => setAudioDelay(val[0])}
                className="cursor-pointer"
              />
              <p className="text-[8px] font-mono text-white/20 uppercase tracking-tighter">Ajuste se o som estiver atrasado ou adiantado</p>
            </div>

            {/* Audio Toggle */}
            <div className="flex items-center justify-between group pt-2 border-t border-red-900/10">
              <div className="flex items-center gap-2">
                <Volume2 className={cn("h-3 w-3 transition-colors", isMuted ? "text-white/20" : "text-red-500 animate-pulse")} />
                <span className="text-[10px] font-mono text-white/60 uppercase">Audio Engine</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsMuted(!isMuted)}
                className={cn(
                  "h-7 px-3 text-[9px] font-mono uppercase border transition-all",
                  isMuted 
                    ? "text-white/40 border-white/10 hover:bg-white/5" 
                    : "text-red-500 border-red-500/30 bg-red-500/10 hover:bg-red-500/20"
                )}
              >
                {isMuted ? "Disabled" : "Operational"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-20 space-y-6">
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
                // Elite Tactical Injection Unit
              </p>
            </div>
          </motion.div>
          
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              <span className="font-mono text-[10px] text-red-500 font-bold uppercase tracking-tighter">Live Connection</span>
            </div>
            <span className="text-[9px] font-mono text-white/40">NODE_ID: 0xFA-88</span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <Card className="lg:col-span-4 border-red-900/30 bg-black/80 backdrop-blur-xl shadow-2xl shadow-red-900/40 kraken-fade-in flex flex-col items-center justify-center p-8 text-center min-h-[550px] relative overflow-hidden group">
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
              <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 backdrop-blur-sm group/item hover:border-red-500/50 transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-red-500" />
                  <div className="text-[10px] text-red-400 font-mono uppercase font-bold">Protocolo Stealth</div>
                </div>
                <div className="text-[11px] text-white/90 text-left font-mono">Bypass nativo indetectável por algoritmos heurísticos de IA.</div>
              </div>
              <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 backdrop-blur-sm group/item hover:border-red-500/50 transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <div className="text-[10px] text-amber-400 font-mono uppercase font-bold">Kraken Dropper</div>
                </div>
                <div className="text-[11px] text-white/90 text-left font-mono">Injeção em tempo real com ofuscação polimórfica dinâmica.</div>
              </div>
              <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 backdrop-blur-sm group/item hover:border-red-500/50 transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  <div className="text-[10px] text-emerald-400 font-mono uppercase font-bold">Multi-Node Hub</div>
                </div>
                <div className="text-[11px] text-white/90 text-left font-mono">Controle centralizado para Nubank, Caixa e Itaú simultâneos.</div>
              </div>
              <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 backdrop-blur-sm group/item hover:border-red-500/50 transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <Terminal className="h-4 w-4 text-blue-500" />
                  <div className="text-[10px] text-blue-400 font-mono uppercase font-bold">Custom black-screen</div>
                </div>
                <div className="text-[11px] text-white/90 text-left font-mono">Criação de telas de engenharia social 100% customizáveis.</div>
              </div>
            </div>
          </Card>

          <div className="lg:col-span-3 space-y-6">
            <Card className="border-amber-900/30 bg-black/80 backdrop-blur-xl kraken-fade-in" style={{ transitionDelay: '0.2s' }}>
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
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-1 group hover:border-emerald-500/30 transition-colors">
                    <div className="text-[9px] text-muted-foreground uppercase font-mono">Encryption</div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-3 w-3 text-emerald-500" />
                      <span className="text-[10px] font-mono font-bold">AES-256-XTS</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-1 group hover:border-amber-500/30 transition-colors">
                    <div className="text-[9px] text-muted-foreground uppercase font-mono">Throughput</div>
                    <div className="flex items-center gap-2">
                      <Activity className="h-3 w-3 text-amber-500" />
                      <span className="text-[10px] font-mono font-bold">1.2 GB/s</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 space-y-2 border-l-4 border-l-red-500">
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
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button 
                        variant="outline" 
                        className="flex-1 flex flex-col h-auto p-4 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black group transition-all"
                        onClick={() => window.open('https://link.mercadopago.com.br/kraken-mensal', '_blank')}
                        aria-label="Adquirir Plano Mensal por 20 mil reais no Mercado Pago"
                      >
                        <span className="text-[10px] text-amber-400 font-bold tracking-widest uppercase">MENSAL</span>
                        <span className="text-xl font-black text-white group-hover:scale-110 transition-transform">R$ 20.000</span>
                        <span className="text-[9px] text-amber-200/80 uppercase mt-1 font-medium">Checkout Mensal</span>
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="flex-1 flex flex-col h-auto p-4 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black group transition-all"
                        onClick={() => window.open('https://link.mercadopago.com.br/kraken-vitalicio', '_blank')}
                        aria-label="Adquirir Plano Vitalício por 30 mil reais no Mercado Pago"
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

            <Card className="border-blue-900/30 bg-black/80 backdrop-blur-xl kraken-fade-in" style={{ transitionDelay: '0.4s' }}>
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
              className="p-4 rounded border border-red-500/20 bg-red-500/5 text-[10px] text-white/80 font-mono space-y-2"
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
