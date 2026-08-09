import React, { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  ShieldAlert, 
  RefreshCcw,
  Search,
  Filter
} from "lucide-react";
import { adminListTrialStats } from "@/lib/trial-monitor.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export function AdminTrialMonitorPanel() {
  const listStatsFn = useServerFn(adminListTrialStats);
  const [data, setData] = useState<{ trials: any[]; blocks: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<"all" | "success" | "blocked">("all");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listStatsFn();
      setData(res);
    } catch (e) {
      toast.error("Erro ao carregar monitor de trials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const allEvents = React.useMemo(() => {
    if (!data) return [];
    const successes = data.trials.map(t => ({
      id: t.id,
      type: "success",
      email: t.profiles?.email,
      date: t.created_at,
      reason: "Provisionado com sucesso",
      licenseId: t.license_id
    }));
    const blocks = data.blocks.map(b => ({
      id: b.id,
      type: "blocked",
      email: b.email_masked || "Oculto (Antifraude)",
      date: b.created_at,
      reason: b.reason || "Bloqueio de segurança",
      licenseId: null
    }));
    
    return [...successes, ...blocks]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .filter(e => {
        const matchesFilter = e.email?.toLowerCase().includes(filter.toLowerCase()) || 
                             e.reason?.toLowerCase().includes(filter.toLowerCase());
        const matchesView = view === "all" || 
                           (view === "success" && e.type === "success") || 
                           (view === "blocked" && e.type === "blocked");
        return matchesFilter && matchesView;
      });
  }, [data, filter, view]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Trial Monitor <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded ml-2">v1.0</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Status e histórico de provisionamento em tempo real.
          </p>
        </div>
        <Button onClick={loadData} disabled={loading} variant="outline" size="sm" className="gap-2">
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card/30 border border-border/50 rounded-xl p-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Total Hoje</div>
          <div className="text-2xl font-bold">{allEvents.length}</div>
        </div>
        <div className="bg-card/30 border border-border/50 rounded-xl p-4">
          <div className="text-xs font-mono text-green-500/70 uppercase tracking-widest mb-1">Sucessos</div>
          <div className="text-2xl font-bold text-green-500">
            {allEvents.filter(e => e.type === "success").length}
          </div>
        </div>
        <div className="bg-card/30 border border-border/50 rounded-xl p-4">
          <div className="text-xs font-mono text-red-500/70 uppercase tracking-widest mb-1">Bloqueios</div>
          <div className="text-2xl font-bold text-red-500">
            {allEvents.filter(e => e.type === "blocked").length}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Filtrar por e-mail ou motivo..." 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9 bg-background/50"
          />
        </div>
        <div className="flex gap-2">
          <Button 
            variant={view === "all" ? "default" : "outline"} 
            size="sm" 
            onClick={() => setView("all")}
          >
            Todos
          </Button>
          <Button 
            variant={view === "success" ? "default" : "outline"} 
            size="sm" 
            onClick={() => setView("success")}
            className={view === "success" ? "bg-green-600 hover:bg-green-700" : ""}
          >
            Sucessos
          </Button>
          <Button 
            variant={view === "blocked" ? "default" : "outline"} 
            size="sm" 
            onClick={() => setView("blocked")}
            className={view === "blocked" ? "bg-red-600 hover:bg-red-700" : ""}
          >
            Bloqueios
          </Button>
        </div>
      </div>

      <div className="bg-card/20 border border-border/40 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border/40">
                <th className="p-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="p-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Usuário</th>
                <th className="p-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Evento / Motivo</th>
                <th className="p-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="h-4 w-4 animate-spin" /> Carregando logs...
                      </div>
                    </td>
                  </tr>
                ) : allEvents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground italic">
                      Nenhum evento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  allEvents.map((event) => (
                    <motion.tr 
                      key={event.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-primary/5 transition-colors group"
                    >
                      <td className="p-4">
                        {event.type === "success" ? (
                          <div className="flex items-center gap-2 text-green-500 font-medium">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Sucesso</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-red-500 font-medium">
                            <ShieldAlert className="h-4 w-4" />
                            <span>Bloqueado</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-mono">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {event.email}
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-foreground">{event.reason}</span>
                          {event.licenseId && (
                            <span className="text-[10px] font-mono opacity-60">LIC: {event.licenseId.substring(0, 8)}...</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono text-xs text-muted-foreground">
                        {new Date(event.date).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3 items-start">
        <Activity className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-200/80 leading-relaxed">
          <strong className="text-blue-400 block mb-1 uppercase tracking-wider">Dica Técnica:</strong>
          Bloqueios frequentes do mesmo IP indicam tentativas de multi-conta. Se um provisionamento de sucesso demorar a aparecer para o cliente, verifique se o ID da licença foi gerado corretamente acima. Falhas de provisionamento no Shadow Node (Yaarsa) agora são auto-recuperáveis e deletam a intenção de trial automaticamente para permitir novas tentativas.
        </div>
      </div>
    </div>
  );
}
