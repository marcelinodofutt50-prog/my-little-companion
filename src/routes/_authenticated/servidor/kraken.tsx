import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skull, AlertTriangle, Shield, Terminal, Zap, Activity, Volume2, VolumeX, RefreshCw } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useServerFn } from "@tanstack/react-start"
import { krakenCommand, type KrakenOutput } from "@/lib/kraken.functions"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
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
  const logEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const executeKraken = useServerFn(krakenCommand);

  useEffect(() => {
    // Entrou na página: ativa efeitos e sons (se não estiver mudo)
    const timer = setTimeout(() => setShowEffects(true), 500);
    
    // Setup áudio
    // Sound of a realistic storm/thunder
    audioRef.current = new Audio("https://cdn.pixabay.com/audio/2022/01/18/audio_823a39e830.mp3");
    audioRef.current.loop = true;
    audioRef.current.volume = 0.5;


    
    return () => {
      clearTimeout(timer);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (!isMuted && showEffects) {
        audioRef.current.play().catch(e => console.log("Audio play blocked", e));
      } else {
        audioRef.current.pause();
      }
    }
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
      {showEffects && <div className="absolute inset-0 pointer-events-none animate-lightning mix-blend-screen z-10" />}

      {/* Audio Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsMuted(!isMuted)}
          className="text-white/50 hover:text-white hover:bg-white/10"
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5 animate-pulse text-red-500" />}
        </Button>
      </div>

      <div className="relative z-20 space-y-6">
        <div className="flex items-center justify-between space-y-2">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="kraken-fade-in"
          >
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter rgb-text animate-rgb-text uppercase italic">
              Kraken RGB
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
          <Card className="lg:col-span-4 border-red-900/30 bg-black/80 backdrop-blur-xl shadow-2xl shadow-red-900/20 kraken-fade-in">
            <CardHeader className="flex flex-row items-center gap-4 border-b border-red-900/20 pb-4">
              <div className="rounded-full bg-red-500/10 p-2 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                <Skull className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-mono uppercase tracking-widest text-red-500">Kraken Terminal</CardTitle>
                <p className="text-[10px] text-muted-foreground uppercase">Direct interface to Shadow-Ops Cluster</p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[400px] overflow-y-auto p-4 font-mono text-xs space-y-1 custom-scrollbar scroll-smooth bg-black/40">
                <AnimatePresence initial={false}>
                  {logs.map((log, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={log.startsWith(">") ? "text-amber-500" : log.startsWith("[ERROR]") ? "text-red-500" : "text-emerald-500/80"}
                    >
                      {log}
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={logEndRef} />
              </div>
              
              <form onSubmit={handleCommand} className="p-4 border-t border-red-900/20 bg-black/60">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-red-500/50" />
                    <Input 
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="Enter tactical command..."
                      className="bg-black/40 border-red-900/30 pl-9 font-mono text-xs focus-visible:ring-red-500/50 h-10 text-white"
                      disabled={isExecuting}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isExecuting}
                    className="bg-red-600 hover:bg-red-700 text-white font-mono text-[10px] uppercase tracking-widest h-10 px-6 shadow-[0_0_15px_rgba(220,38,38,0.4)]"
                  >
                    {isExecuting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    <span className="ml-2 hidden sm:inline">Dispatch</span>
                  </Button>
                </div>
              </form>
            </CardContent>
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
                    "A Kraken não é apenas uma ferramenta; é uma entidade. Sem testes grátis. Somente operadores qualificados."
                  </p>
                  <div className="pt-2 border-t border-red-500/10 mt-2">
                    <p className="text-[9px] text-muted-foreground uppercase font-mono">Pricing:</p>
                    <div className="flex gap-4 mt-1">
                      <span className="text-[10px] text-amber-400 font-bold">R$ 20.000 / MENSAL</span>
                      <span className="text-[10px] text-emerald-400 font-bold">R$ 30.000 / VITALÍCIO</span>
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
              className="p-4 rounded border border-white/5 bg-white/5 text-[9px] text-muted-foreground font-mono leading-tight"
            >
              [NOTE] Após a aquisição, um ticket de prioridade máxima será aberto automaticamente no suporte Shadow para entrega imediata das credenciais.
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
