import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skull, AlertTriangle, Shield, Terminal, Zap, Activity } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useServerFn } from "@tanstack/react-start"
import { krakenCommand } from "@/lib/kraken.functions"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

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
  const logEndRef = useRef<HTMLDivElement>(null);
  const executeKraken = useServerFn(krakenCommand);

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
      const res = await executeKraken({ data: { command: cmd } });
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
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 bg-black/20 min-h-screen">
      <div className="flex items-center justify-between space-y-2">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-red-600 via-amber-500 to-red-600 bg-clip-text text-transparent animate-pulse">
            Kraken Control Unit
          </h2>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest mt-1">
            // Advanced Payload Injection & Command Console
          </p>
        </motion.div>
        
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
          <span className="font-mono text-[10px] text-red-500 font-bold uppercase tracking-tighter">Live Connection</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-red-900/30 bg-black/60 backdrop-blur-xl shadow-2xl shadow-red-900/10">
          <CardHeader className="flex flex-row items-center gap-4 border-b border-red-900/20 pb-4">
            <div className="rounded-full bg-red-500/10 p-2 border border-red-500/20">
              <Skull className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <CardTitle className="text-sm font-mono uppercase tracking-widest">Kraken Terminal</CardTitle>
              <p className="text-[10px] text-muted-foreground uppercase">Direct interface to Shadow-Ops Cluster</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[400px] overflow-y-auto p-4 font-mono text-xs space-y-1 custom-scrollbar scroll-smooth">
              <AnimatePresence initial={false}>
                {logs.map((log, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={log.startsWith(">") ? "text-amber-500" : log.startsWith("[ERROR]") ? "text-red-500" : "text-emerald-500/80"}
                  >
                    {log}
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={logEndRef} />
            </div>
            
            <form onSubmit={handleCommand} className="p-4 border-t border-red-900/20 bg-black/40">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input 
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="Enter command (e.g. inject --payload=shadow-x)..."
                    className="bg-black/40 border-red-900/30 pl-9 font-mono text-xs focus-visible:ring-red-500/50 h-9"
                    disabled={isExecuting}
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isExecuting}
                  className="bg-red-600 hover:bg-red-700 text-white font-mono text-[10px] uppercase tracking-widest h-9"
                >
                  {isExecuting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  <span className="ml-2 hidden sm:inline">Execute</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          <Card className="border-amber-900/30 bg-black/60 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="rounded-full bg-amber-500/10 p-2 border border-amber-500/20">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-mono uppercase tracking-widest">Security Protocol</CardTitle>
                <p className="text-[10px] text-muted-foreground uppercase">Encryption & Node Metrics</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-1">
                  <div className="text-[9px] text-muted-foreground uppercase font-mono">Encryption</div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-3 w-3 text-emerald-500" />
                    <span className="text-[10px] font-mono font-bold">AES-256-XTS</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-1">
                  <div className="text-[9px] text-muted-foreground uppercase font-mono">Throughput</div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] font-mono font-bold">1.2 GB/s</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-red-500/10 bg-red-500/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-red-400 font-bold">STATUS: STANDBY</span>
                  <div className="flex gap-1">
                    <div className="h-1 w-3 bg-red-500/50 rounded-full" />
                    <div className="h-1 w-3 bg-red-500/50 rounded-full" />
                    <div className="h-1 w-3 bg-red-500/20 rounded-full" />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  O módulo Kraken é a unidade de elite da Shadow Ops para interceptação e controle remoto. 
                  Sincronização com cluster Node-FA88 concluída com sucesso.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-900/30 bg-black/60 backdrop-blur-xl">
             <CardHeader>
               <CardTitle className="text-xs font-mono uppercase tracking-widest text-blue-400">Quick Actions</CardTitle>
             </CardHeader>
             <CardContent className="grid grid-cols-2 gap-2">
                {["Reboot Node", "Sync Keys", "Flush Cache", "Auto-Inject"].map(act => (
                  <Button 
                    key={act} 
                    variant="outline" 
                    size="sm"
                    className="text-[9px] font-mono uppercase border-blue-900/20 bg-blue-900/5 hover:bg-blue-900/20"
                    onClick={() => setCommand(act.toLowerCase().replace(" ", "-"))}
                  >
                    {act}
                  </Button>
                ))}
             </CardContent>
          </Card>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(220, 38, 38, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(220, 38, 38, 0.5);
        }
      `}</style>
    </div>
  )
}

import { RefreshCw } from "lucide-react"

