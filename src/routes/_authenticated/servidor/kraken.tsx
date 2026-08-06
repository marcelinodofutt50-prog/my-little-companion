import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skull, AlertTriangle, Shield, Terminal, Zap, Activity, Volume2, VolumeX, RefreshCw, Sliders } from "lucide-react"
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
  const [isMuted, setIsMuted] = useState(true);
  const [intensity, setIntensity] = useState(1);

  const logEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const executeKraken = useServerFn(krakenCommand);

  useEffect(() => {
    // Entrou na página: ativa efeitos e sons (se não estiver mudo)
    const timer = setTimeout(() => setShowEffects(true), 500);
    
    // Setup áudio
    // Setup áudio
    audioRef.current = new Audio("https://www.soundjay.com/nature/thunder-01.mp3");
    audioRef.current.loop = false;
    audioRef.current.volume = 0.5;
    audioRef.current.preload = "auto";

    const lightningInterval = setInterval(() => {
      if (showEffects) {
        if (!isMuted && audioRef.current) {
          // Usamos um clone para permitir sons sobrepostos e garantir o play imediato
          const thunderClone = audioRef.current.cloneNode() as HTMLAudioElement;
          thunderClone.volume = 0.7 + Math.random() * 0.3;
          thunderClone.play().catch(e => console.log("Audio play blocked", e));
        }
      }
    }, 4000);
    
    return () => {
      clearTimeout(timer);
      clearInterval(lightningInterval);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isMuted, showEffects]);


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
      setLogs(prev => [...prev, `[KRAKEN] ${res.message}`]);
      if (res.success) {
        toast.success("Comando Kraken executado");
      }
    } catch (err) {
      setLogs(prev => [...prev, `[ERROR] Failed to dispatch payload: ${cmd}`]);
      toast.error("Falha na comunicação com o Kraken");
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="relative flex-1 space-y-6 p-4 md:p-8 pt-6 bg-black min-h-screen overflow-hidden">
      {/* Background Images with Fade */}
      <AnimatePresence>
        {showEffects && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              className="absolute inset-0 pointer-events-none"
              style={{ 
                backgroundImage: `url(${krakenBg4.url})`, 
                backgroundSize: 'cover', 
                backgroundPosition: 'center' 
              }}
            />
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.2 }}
              transition={{ delay: 2 }}
              className="absolute inset-0 pointer-events-none mix-blend-overlay"
              style={{ 
                backgroundImage: `url(${krakenBg5.url})`, 
                backgroundSize: 'cover', 
                backgroundPosition: 'center' 
              }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Lightning Effect Overlay */}
      {showEffects && (
        <div 
          className="absolute inset-0 pointer-events-none animate-lightning mix-blend-screen z-10 overflow-hidden" 
          style={{ '--lightning-opacity': intensity } as React.CSSProperties}
        >
          {/* Hardware-accelerated glow substitute for heavy box-shadow */}
          <div className="absolute inset-0 bg-white/30 blur-[100px] opacity-0 animate-lightning" />
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
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter rgb-text animate-rgb-text uppercase italic">
              Kraken (2.0)
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
          <Card className="lg:col-span-4 border-red-900/30 bg-black/80 backdrop-blur-xl shadow-2xl shadow-red-900/40 kraken-fade-in flex flex-col items-center justify-center p-8 text-center min-h-[500px] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
              <div className="rounded-full bg-black/50 p-8 border border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.4)] mb-8 relative z-10">
                <Skull className="h-20 w-20 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
              </div>
            </div>

            <CardTitle className="text-3xl md:text-4xl font-black font-mono uppercase tracking-[0.4em] text-red-500 mb-6 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">
              KRAKEN UNIT
            </CardTitle>
            
            <div className="max-w-md space-y-4">
              <p className="text-base text-white font-medium uppercase tracking-wider leading-relaxed">
                A evolução definitiva da Btmob.
              </p>
              <p className="text-xs text-muted-foreground uppercase leading-relaxed tracking-widest">
                Desenvolvida para operadores que exigem invisibilidade absoluta e execução cirúrgica em ambientes hostis.
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
              <div className="font-bold text-red-400 uppercase tracking-wider border-b border-red-500/20 pb-1 mb-2">Diferenciais Elite:</div>
              <ul className="grid grid-cols-1 gap-1.5 list-disc pl-4">
                <li>Apk simples e fácil de criar</li>
                <li>Kraken Dropper integrado</li>
                <li>Nova interface tática simplificada</li>
                <li>Criação personalizada de Tela Preta</li>
                <li>Módulos: Nubank, Caixa e Itaú</li>
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
