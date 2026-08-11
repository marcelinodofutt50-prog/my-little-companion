import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { Video, Youtube, ChevronRight, Play, BookOpen, Star, Info, CheckCircle2, Circle, Trophy, Search, Filter, RefreshCw, Activity, Clock, Server, ShieldCheck, AlertCircle, Database, Zap, Shield } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { getTutorials } from "@/lib/tutorial-loader.functions";
import { getTutorialProgress, toggleTutorialStatus } from "@/lib/tutorial-progress.functions";
import { useTutorialMedia } from "@/lib/tutorial-media";

import { toast } from "sonner";
import trainingBgAsset from "@/assets/kraken_v31_final.webp.asset.json";
import { runSchemaHealthCheck } from "@/lib/health-check.functions";
import { testDatabaseConnection } from "@/lib/diagnostics.functions";


export const Route = createFileRoute("/_authenticated/tutoriais")({
  head: () => ({ meta: [{ title: "Shadow Knowledge Base — Centro de Treinamento" }] }),
  component: TutorialsPage,
});





function TutorialsPage() {
  const [tutorials, setTutorials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Tudo");
  const [syncHistory, setSyncHistory] = useState<{ time: string; status: 'success' | 'error'; type: 'auto' | 'manual'; message?: string }[]>([]);
  const [showSyncStatus, setShowSyncStatus] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('shadow_sync_history');
    if (saved) {
      try {
        setSyncHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse sync history", e);
      }
    }
  }, []);

  
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagResult, setDiagResult] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  
  const addSyncLog = useCallback((status: 'success' | 'error', type: 'auto' | 'manual', message?: string) => {
    setSyncHistory(prev => {
      const newHistory = [{
        time: new Date().toLocaleTimeString('pt-BR'),
        status,
        type,
        message,
        route: typeof window !== 'undefined' ? window.location.pathname : ''
      }, ...prev].slice(0, 10);
      if (typeof window !== 'undefined') {
        localStorage.setItem('shadow_sync_history', JSON.stringify(newHistory));
      }
      return newHistory;
    });
  }, []);
  
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectedVideoUrl = useTutorialMedia(selected?.video_url);
  const selectedPosterUrl = useTutorialMedia(selected?.image_url);

  
  const listFn = useServerFn(getTutorials);
  const getProgressFn = useServerFn(getTutorialProgress);
  const toggleFn = useServerFn(toggleTutorialStatus);
  const testConnFn = useServerFn(testDatabaseConnection);
  const healthCheckFn = useServerFn(runSchemaHealthCheck);

  // Health check automático pós-deploy/carregamento
  useEffect(() => {
    const performHealthCheck = async () => {
      try {
        const res = await healthCheckFn();
        if (res.status === 'unstable' || res.status === 'critical') {
          console.warn("[Shadow-Ops] Inconsistência de schema detectada via Health Check.");
          toast.info("Calibrando conexão tática...", {
            description: "O sistema detectou uma instabilidade de sincronização e está auto-corrigindo.",
            duration: 5000
          });
        }
      } catch (e) {
        // Silencioso em caso de erro de rede no check
      }
    };
    
    // Pequeno delay para garantir hidratação total
    const timer = setTimeout(performHealthCheck, 3000);
    return () => clearTimeout(timer);
  }, [healthCheckFn]);


  const loadData = useCallback(async (forceRepair = false) => {
    setLoading(true);
    try {
      console.log("[tutorials] Iniciando ciclo de carregamento resiliente...");

      if (forceRepair) {
        toast.loading("Sincronizando banco de dados...", { id: "sync-toast" });
        const { supabase } = await import("@/integrations/supabase/client");
        await (supabase as any).rpc("force_refresh_schema_permissions");
        await new Promise(resolve => setTimeout(resolve, 1500));
        await (supabase as any).from("tutorials").select("id").limit(1);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // A lista e o progresso são independentes: uma falha de progresso
      // não pode mais esconder todo o Centro de Treinamento.
      const [tRes, pRes] = await Promise.allSettled([listFn({}), getProgressFn()]);

      if (tRes.status === "rejected") throw tRes.reason;

      const validTutorials = ((tRes.value as any[]) || []).filter(
        (t: any) => t && t.id && (t.title || t.category),
      );
      setTutorials(validTutorials);
      setLoadError(null);
      setCompletedIds(pRes.status === "fulfilled" ? ((pRes.value as string[]) || []) : []);

      if (forceRepair) {
        toast.success("Shadow Core sincronizado com sucesso!", { id: "sync-toast" });
        addSyncLog('success', 'manual', 'Reparo tático concluído com sucesso');
      } else if (validTutorials.length > 0) {
        console.log(`[tutorials] Sincronização bem-sucedida: ${validTutorials.length} módulos ativos.`);
        addSyncLog('success', 'auto', 'Carregamento tático concluído');
      } else {
        console.log("[tutorials] Conexão OK, mas nenhum módulo publicado ainda.");
        addSyncLog('success', 'auto', 'Conexão OK — nenhum módulo publicado');
      }
    } catch (err: any) {
      console.error("[tutorials] Falha no carregamento:", err);
      setLoadError(err?.message || "Falha de rede");
      addSyncLog('error', 'auto', `Erro de sincronização: ${err.message || 'Falha de rede'}`);

      if (!forceRepair) {
        console.warn("[tutorials] Falha persistente detectada. Acionando reparo de emergência em 3s...");
        setTimeout(() => loadData(true), 3000);
      }
    } finally {
      setLoading(false);
    }
  }, [listFn, getProgressFn, addSyncLog]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const categories = useMemo(() => {
    const cats = new Set<string>(["Tudo"]);
    tutorials.forEach(t => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats);
  }, [tutorials]);

  const filteredTutorials = useMemo(() => {
    return (tutorials || []).filter(t => {
      if (!t) return false;
      const matchesSearch = (t.title?.toLowerCase() || "").includes(search.toLowerCase()) || 
                           (t.description?.toLowerCase() || "").includes(search.toLowerCase());
      const matchesCategory = activeCategory === "Tudo" || t.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [tutorials, search, activeCategory]);

  const statsByCategory = useMemo(() => {
    const groups: Record<string, { total: number; completed: number }> = {};
    tutorials.forEach(t => {
      const cat = t.category || "Geral";
      if (!groups[cat]) groups[cat] = { total: 0, completed: 0 };
      groups[cat].total++;
      if (completedIds.includes(t.id)) groups[cat].completed++;
    });
    return groups;
  }, [tutorials, completedIds]);

  const progress = useMemo(() => {
    if (tutorials.length === 0) return 0;
    return Math.round((completedIds.length / tutorials.length) * 100);
  }, [tutorials, completedIds]);

  const handleToggle = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const isCompleted = completedIds.includes(id);
    const newIds = isCompleted 
      ? completedIds.filter(i => i !== id)
      : [...completedIds, id];
    
    setCompletedIds(newIds);
    try {
      await toggleFn({ data: { tutorialId: id, completed: !isCompleted } });
      toast.success(isCompleted ? "Marcado como não assistido" : "Tutorial concluído!");
    } catch (err) {
      setCompletedIds(completedIds); 
      toast.error("Erro ao atualizar progresso");
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-black theme-transition transition-colors duration-500 relative">
        <div 
          className="fixed inset-0 z-0 pointer-events-none opacity-40 bg-cover bg-center transition-opacity duration-1000"
          style={{ 
            backgroundImage: `url(${trainingBgAsset.url}?v=v31)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.6) contrast(1.2)'
          }}
        />
        <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-black/50 via-black/70 to-black" />

        <div className="relative z-20">
          <AppSidebar />
        </div>
        <main className="flex-1 overflow-y-auto relative z-10">
          <SiteHeader />
          <HealthWidget />
          <div className="container mx-auto px-4 py-8">
            <div className="mb-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="text-center md:text-left">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                    Shadow Knowledge Base
                  </div>
                  <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl rgb-text animate-rgb-text uppercase italic">
                    Centro de Treinamento
                  </h1>
                  <p className="mt-4 max-w-2xl text-muted-foreground">
                    Domine o ecossistema Shadow. De configurações básicas a técnicas avançadas de bypass e gestão de ativos.
                  </p>
                </div>
                
                {!loading && tutorials.length > 0 && progress > 0 && (
                  <div className="w-full md:w-80 space-y-4 enterprise-surface p-5 rounded-xl border-primary/20 bg-primary/5 shadow-lg shadow-primary/5 rgb-border overflow-hidden">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
                        <span className="flex items-center gap-2"><Trophy className="h-3 w-3 text-primary" /> Progresso Total</span>
                        <span className="text-primary font-bold">{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          className="h-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                        />
                      </div>

                    </div>
                  </div>
                )}
              </div>
            </div>

            {!loading && tutorials.length === 0 && loadError && (
              <div className="enterprise-surface p-12 rounded-2xl border-primary/10 text-center space-y-6 mb-10">
                <div className="flex justify-center">
                  <div className="p-4 rounded-full bg-primary/5 border border-primary/10 relative">
                    <BookOpen className="h-12 w-12 text-primary/20" />
                    <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping opacity-20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-foreground font-mono uppercase tracking-widest">Aguardando Sincronização</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto text-sm leading-relaxed">
                    O sistema está pronto, mas o cache do banco de dados ainda não reconheceu a tabela. Clique abaixo para forçar a sincronização tática do Centro de Treinamento.
                  </p>
                </div>
                <div className="flex flex-col gap-3 items-center">
                  <Button 
                    variant="default" 
                    size="lg" 
                    onClick={async () => {
                      const loadToast = toast.loading("Executando reparo tático...");
                      try {
                        await loadData(true);
                        toast.success("Sincronização processada com sucesso!", { id: loadToast });
                      } catch (err: any) {
                        console.error("[tutorials] Manual repair flow failed:", err);
                        toast.error("Falha ao sincronizar: " + (err.message || "Erro desconhecido"), { id: loadToast });
                      }
                    }}
                    className="font-mono text-xs uppercase bg-primary hover:bg-primary/90 text-primary-foreground px-8"
                  >
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin-slow" /> Sincronizar Agora
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.location.reload()}
                    className="font-mono text-[10px] uppercase border-primary/20 opacity-60 hover:opacity-100"
                  >
                    Recarregar Página
                  </Button>
                </div>
              </div>
            )}

            {/* Sync Status Panel */}
            <div className="mb-8">
            {/* Diagnostic and Sync Controls */}
            <div className="mb-8 flex flex-wrap gap-3">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setShowSyncStatus(!showSyncStatus);
                  if (showDiagnostics) setShowDiagnostics(false);
                }}
                className={`font-mono text-[10px] uppercase tracking-widest gap-2 border rounded-full px-4 transition-all ${showSyncStatus ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-primary/5 border-primary/10 text-primary/60 hover:text-primary'}`}
              >
                <Activity className={`h-3 w-3 ${loading ? 'animate-pulse' : ''}`} />
                Status da Sincronização: {loading ? 'Sincronizando...' : 'Online'}
              </Button>

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setShowDiagnostics(!showDiagnostics);
                  if (showSyncStatus) setShowSyncStatus(false);
                }}
                className={`font-mono text-[10px] uppercase tracking-widest gap-2 border rounded-full px-4 transition-all ${showDiagnostics ? 'bg-orange-500/20 border-orange-500/40 text-orange-500' : 'bg-orange-500/5 border-orange-500/10 text-orange-500/60 hover:text-orange-500'}`}
              >
                <Zap className={`h-3 w-3 ${diagLoading ? 'animate-spin' : ''}`} />
                Painel de Diagnóstico
              </Button>
            </div>

            {/* Diagnostics Panel */}
            <AnimatePresence>
              {showDiagnostics && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-8"
                >
                  <Card className="bg-black/40 border-orange-500/20 backdrop-blur-xl enterprise-surface overflow-hidden">
                    <div className="px-6 py-4 border-b border-orange-500/10 bg-orange-500/5 flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <Zap className="h-5 w-5 text-orange-500" />
                        <div>
                          <h3 className="text-sm font-bold text-foreground font-mono uppercase tracking-widest">Diagnóstico Tático do Banco</h3>
                          <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">Validação de integridade Shadow Core</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          onClick={async () => {
                            setDiagLoading(true);
                            try {
                              const res = await testConnFn();
                              setDiagResult(res);
                              if (res.success) toast.success("Conexão estável identificada.");
                              else toast.error("Falha na integridade dos dados.");
                            } catch (err) {
                              setDiagResult({ success: false, error: "Falha na comunicação com o servidor Shadow." });
                            } finally {
                              setDiagLoading(false);
                            }
                          }}
                          disabled={diagLoading}
                          className="bg-orange-500 hover:bg-orange-600 text-white font-mono text-[10px] uppercase h-8"
                          aria-label="Executar Teste de Acesso"
                        >
                          {diagLoading ? <RefreshCw className="h-3 w-3 animate-spin mr-2" /> : <Database className="h-3 w-3 mr-2" />}
                          Executar Teste
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={async () => {
                            const loadToast = toast.loading("Simulando falha e reparo...");
                            try {
                              const { simulateSchemaFailure } = await import('@/lib/diagnostics.functions');
                              const res = await simulateSchemaFailure();
                              if (res.success) {
                                toast.success("Teste de resiliência concluído!", { id: loadToast });
                                await loadData();
                              } else {
                                toast.error("Falha no teste: " + res.error, { id: loadToast });
                              }
                            } catch (err: any) {
                              toast.error("Erro no teste: " + err.message, { id: loadToast });
                            }
                          }}
                          className="border-orange-500/30 text-orange-500 font-mono text-[10px] uppercase h-8 hover:bg-orange-500/10"
                        >
                          Simular Falha (Resiliência)
                        </Button>
                      </div>
                    </div>

                    
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Status da Conexão</div>
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${diagResult ? (diagResult.success ? 'bg-green-500 animate-pulse' : 'bg-red-500') : 'bg-gray-500'}`} />
                          <span className="text-xs font-bold uppercase font-mono tracking-wider">
                            {!diagResult ? 'PENDENTE' : (diagResult.success ? 'ESTÁVEL' : 'INSTÁVEL')}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Latência Shadow</div>
                        <div className="text-xs font-bold uppercase font-mono tracking-wider">
                          {diagResult?.latency ? `${diagResult.latency}ms` : '---'}
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Última Tentativa</div>
                        <div className="text-xs font-bold uppercase font-mono tracking-wider">
                          {syncHistory[0]?.time || 'Aguardando'}
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Integridade de Schema</div>
                        <div className="text-xs font-bold uppercase font-mono tracking-wider flex items-center gap-2 text-green-500">
                          <Shield className="h-3 w-3" /> ATIVO
                        </div>
                      </div>
                    </div>

                    {diagResult && !diagResult.success && (
                      <div className="mx-6 mb-6 p-4 rounded-xl bg-red-500/5 border border-red-500/20 flex items-start gap-3">
                        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-red-500 uppercase font-mono">Erro Identificado</div>
                          <div className="text-[10px] text-red-400/80 font-mono leading-relaxed">
                            {diagResult.error || "Erro desconhecido durante a validação tática."}
                            {diagResult.code && <span className="block mt-1 font-bold">CÓDIGO: {diagResult.code}</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

              <AnimatePresence>
                {showSyncStatus && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <Card className="bg-black/40 border-primary/20 backdrop-blur-xl p-4 enterprise-surface">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                            <Server className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="text-[10px] font-mono uppercase text-muted-foreground">Sistema</div>
                            <div className="text-xs font-bold text-foreground">PostgREST Cache Bridge</div>
                          </div>
                        </div>
                      </Card>

                      <Card className="bg-black/40 border-primary/20 backdrop-blur-xl p-4 enterprise-surface">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                            <ShieldCheck className="h-4 w-4 text-green-500" />
                          </div>
                          <div>
                            <div className="text-[10px] font-mono uppercase text-muted-foreground">Status Atual</div>
                            <div className="text-xs font-bold text-green-500">{loading ? 'Validando Schema...' : 'Sincronizado'}</div>
                          </div>
                        </div>
                      </Card>

                      <Card className="bg-black/40 border-primary/20 backdrop-blur-xl p-4 enterprise-surface">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                            <Clock className="h-4 w-4 text-orange-500" />
                          </div>
                          <div>
                            <div className="text-[10px] font-mono uppercase text-muted-foreground">Última Verificação</div>
                            <div className="text-xs font-bold text-foreground">{syncHistory[0]?.time || 'Agora'}</div>
                          </div>
                        </div>
                      </Card>
                    </div>

                    <Card className="bg-black/40 border-primary/20 backdrop-blur-xl overflow-hidden enterprise-surface">
                      <div className="px-4 py-2 border-b border-primary/10 bg-primary/5 flex items-center justify-between">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-primary/80">Histórico de Tentativas Recentes</div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => loadData(true)}
                          disabled={loading}
                          className="h-6 text-[9px] font-mono uppercase hover:bg-primary/10"
                        >
                          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Forçar Flush
                        </Button>
                      </div>
                      <div className="p-0">
                        {syncHistory.length === 0 ? (
                          <div className="p-8 text-center text-xs text-muted-foreground font-mono uppercase tracking-widest opacity-50">
                            Nenhuma atividade registrada no ciclo atual.
                          </div>
                        ) : (
                          <div className="divide-y divide-primary/5">
                            {syncHistory.map((log, i) => (
                              <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center gap-4">
                                  <div className={`w-1.5 h-1.5 rounded-full ${log.status === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                                  <div>
                                    <div className="text-[10px] font-mono font-bold uppercase flex items-center gap-2">
                                      {log.status === 'success' ? 'Operação Concluída' : 'Falha Detectada'}
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] border ${log.type === 'manual' ? 'border-orange-500/30 bg-orange-500/5 text-orange-500' : 'border-blue-500/30 bg-blue-500/5 text-blue-500'}`}>
                                        {log.type.toUpperCase()}
                                      </span>
                                    </div>
                                    <div className="text-[9px] text-muted-foreground font-mono mt-0.5">{log.message || 'Ciclo de validação de rotina.'}</div>
                                  </div>
                                </div>
                                <div className="text-[10px] font-mono text-muted-foreground/60">{log.time}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="mt-6 border-t border-primary/10 pt-6">
                          <h4 className="text-[10px] font-mono uppercase tracking-widest text-primary/50 mb-3 flex items-center gap-2">
                            <Activity className="h-3 w-3" /> Diagnóstico de Conexão
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="enterprise-surface p-3 rounded-xl border-primary/5">
                              <div className="text-[8px] text-muted-foreground font-mono uppercase tracking-[0.2em] mb-1">Último Código</div>
                              <div className="text-xs font-bold font-mono">{syncHistory[0]?.status === 'error' ? 'PGRST108' : '200 OK'}</div>
                            </div>
                            <div className="enterprise-surface p-3 rounded-xl border-primary/5">
                              <div className="text-[8px] text-muted-foreground font-mono uppercase tracking-[0.2em] mb-1">Tunnel Status</div>
                              <div className={`text-xs font-bold font-mono ${tutorials.length > 0 ? 'text-emerald-500' : 'text-orange-500 animate-pulse'}`}>
                                {tutorials.length > 0 ? 'ESTÁVEL' : 'SINCRONIZANDO'}
                              </div>
                            </div>
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={diagLoading}
                            onClick={async () => {
                              setDiagLoading(true);
                              try {
                                const res = await testConnFn();
                                setDiagResult(res);
                                setShowDiagnostics(true);
                                toast.success("Diagnóstico concluído!");
                              } catch (e: any) {
                                toast.error("Falha no teste: " + e.message);
                              } finally {
                                setDiagLoading(false);
                              }
                            }}
                            className="w-full mt-4 h-9 bg-primary/5 border-primary/10 text-[9px] font-mono uppercase tracking-widest hover:bg-primary/10 transition-colors"
                          >
                            {diagLoading ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <ShieldCheck className="h-3 w-3 mr-2" />}
                            Executar Teste de Estresse
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Filter Bar */}
            <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                {categories.map(cat => (
                  <Button
                    key={cat}
                    variant={activeCategory === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveCategory(cat)}
                    className={`rounded-full px-4 h-8 text-[10px] font-mono uppercase tracking-widest transition-all ${
                      activeCategory === cat ? "shadow-lg shadow-primary/20" : "border-primary/10 hover:border-primary/30"
                    }`}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  value={search}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                  placeholder="Buscar tutorial..."
                  className="pl-10 h-10 bg-primary/5 border-primary/10 rounded-full text-xs font-mono uppercase tracking-widest focus:ring-primary/20"
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {selected && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-12"
                >
                  <div className="overflow-hidden rounded-2xl border border-primary/20 bg-black/90 dark:bg-black/95 backdrop-blur-3xl shadow-2xl transition-colors duration-500">
                    <div className="aspect-video w-full bg-black relative">
                      {selected.video_url ? (
                        selectedVideoUrl ? (
                          <video 
                            key={selectedVideoUrl}
                            src={selectedVideoUrl} 
                            controls 
                            playsInline
                            controlsList="nodownload"
                            className="h-full w-full object-contain"
                            poster={selectedPosterUrl || undefined}
                            autoPlay
                          >
                            Seu navegador não suporta a reprodução de vídeos.
                          </video>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <RefreshCw className="h-6 w-6 animate-spin text-primary/60" />
                          </div>
                        )
                      ) : selected.youtube_url ? (

                        <iframe
                          key={selected.youtube_url}
                          className="h-full w-full"
                          src={selected.youtube_url.includes("embed") ? selected.youtube_url : selected.youtube_url.replace("watch?v=", "embed/") + "?autoplay=1&rel=0"}
                          title={selected.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-muted-foreground bg-primary/5">
                          <Video className="h-16 w-16 opacity-10 animate-pulse" />
                          <p className="font-mono text-[10px] uppercase tracking-[0.3em]">Sinal de Mídia Ausente</p>
                        </div>
                      )}
                    </div>
                    <div className="p-6 md:p-8">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{selected.category}</div>
                          <h2 className="text-2xl font-bold text-foreground md:text-3xl">{selected.title}</h2>
                          <p className="text-muted-foreground leading-relaxed">{selected.description}</p>
                        </div>
                        <div className="flex gap-2">
                           <Button 
                             variant={completedIds.includes(selected.id) ? "default" : "outline"} 
                             size="sm" 
                             onClick={(e) => handleToggle(e, selected.id)}
                             className="gap-2"
                           >
                             {completedIds.includes(selected.id) ? (
                               <><CheckCircle2 className="h-4 w-4" /> Concluído</>
                             ) : (
                               <><Circle className="h-4 w-4" /> Marcar como Assistido</>
                             )}
                           </Button>
                           {selected.youtube_url && (
                             <Button variant="outline" size="sm" asChild className="gap-2 border-red-500/20 hover:bg-red-500/10 hover:text-red-500">
                               <a href={selected.youtube_url} target="_blank" rel="noopener noreferrer">
                                 <Youtube className="h-4 w-4" /> Detalhes no YouTube
                               </a>
                             </Button>
                           )}
                           <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Fechar</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {!loading && filteredTutorials.length > 0 && filteredTutorials.map((t, idx) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (idx % 4) * 0.1 }}
                >
                    <Card 
                      className="group h-full cursor-pointer overflow-hidden border-border/40 bg-black/80 dark:bg-black/90 backdrop-blur-3xl transition-all duration-500 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.98]"
                    onClick={() => {
                      setSelected(t);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <div className="relative aspect-video w-full overflow-hidden">
                      {t.image_url ? (
                        <TutorialThumb url={t.image_url} title={t.title} />
                      ) : (

                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted/20 to-primary/5">
                          <Video className="h-8 w-8 text-primary/20 group-hover:text-primary/40 transition-colors" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
                      
                      <div className="absolute top-3 left-3 flex gap-2">
                        <div className="rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-md border border-white/10">
                          <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-primary font-bold">{t.category || "Geral"}</span>
                        </div>
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                         <div className="flex gap-2">
                           {completedIds.includes(t.id) && (
                             <div className="rounded bg-emerald-500/10 px-2 py-0.5 backdrop-blur-md border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                               <span className="font-mono text-[9px] uppercase tracking-widest text-emerald-500 font-bold flex items-center gap-1">
                                 <CheckCircle2 className="h-2.5 w-2.5" /> Concluído
                               </span>
                             </div>
                           )}
                         </div>
                         <div className="flex gap-2">
                           <button 
                             onClick={(e) => handleToggle(e, t.id)}
                             className="rounded-full bg-black/60 p-2.5 backdrop-blur-md hover:bg-primary/20 transition-colors border border-white/10 group-active:scale-90"
                           >
                             {completedIds.includes(t.id) ? (
                               <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                             ) : (
                               <Circle className="h-3.5 w-3.5 text-white/40" />
                             )}
                           </button>
                           <div className="rounded-full bg-primary/20 p-2.5 backdrop-blur-md opacity-0 scale-90 transition-all group-hover:opacity-100 group-hover:scale-100 border border-primary/20">
                             <Play className="h-3.5 w-3.5 fill-primary text-primary" />
                           </div>
                         </div>
                      </div>
                    </div>
                    <CardContent className="p-5">
                      <h3 className="font-bold text-foreground text-sm line-clamp-2 group-hover:text-primary transition-colors leading-tight h-10">{t.title}</h3>
                      <p className="mt-2 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity h-8">{t.description || "Nenhuma descrição disponível para este módulo."}</p>
                      <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-4">
                        <div className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                           <BookOpen className="h-3 w-3 text-primary/50" /> Módulo {idx + 1}
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-primary transition-transform group-hover:translate-x-1" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              {loading && Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] rounded-xl bg-card/20 animate-pulse border border-border/10 overflow-hidden">
                  <div className="aspect-video bg-muted/20" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 w-3/4 bg-muted/20 rounded" />
                    <div className="h-3 w-full bg-muted/10 rounded" />
                  </div>
                </div>
              ))}
            </div>

            {!loading && filteredTutorials.length === 0 && tutorials.length > 0 && (
              <div className="py-20 text-center">
                <p className="text-muted-foreground font-mono uppercase tracking-widest text-xs">Nenhum resultado para "{search}"</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

function TutorialThumb({ url, title }: { url: string; title: string }) {
  const resolved = useTutorialMedia(url);
  if (!resolved) {
    return <div className="h-full w-full animate-pulse bg-gradient-to-br from-muted/20 to-primary/5" />;
  }
  return (
    <img
      src={resolved}
      alt={title}
      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
      loading="lazy"
    />
  );
}

function HealthWidget() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/public/health');
        if (!res.ok) throw new Error('Health check failed');
        const data = await res.json();
        setHealth(data);
      } catch (e) {
        console.error("Health check failed", e);
      }
    };
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, []);

  if (!health) return null;

  const isHealthy = health.status === 'healthy';
  const isDegraded = health.status === 'unstable' || health.status === 'degraded';
  const tutorialProgressStatus = health.tables?.tutorial_progress?.accessible;

  return (
    <div className="bg-black/40 border-b border-white/5 py-2 px-4 flex flex-wrap items-center justify-center gap-4 text-[10px] font-mono uppercase tracking-widest overflow-hidden">
      <div className="flex items-center gap-2">
        <Database className={`h-3 w-3 ${isHealthy ? 'text-green-500' : isDegraded ? 'text-yellow-500' : 'text-red-500'}`} />
        <span className="text-muted-foreground">DB STATUS:</span>
        <span className={isHealthy ? 'text-green-500' : isDegraded ? 'text-yellow-500' : 'text-red-500'}>{health.status}</span>
      </div>
      <div className="h-3 w-[1px] bg-white/10" />
      <div className="flex items-center gap-2">
        <Activity className={`h-3 w-3 ${tutorialProgressStatus ? 'text-primary' : 'text-red-500 animate-pulse'}`} />
        <span className="text-muted-foreground">SYNC:</span>
        <span className={tutorialProgressStatus ? 'text-primary' : 'text-red-500'}>{tutorialProgressStatus ? 'OPERATIONAL' : 'REPAIRING'}</span>
      </div>
      <div className="h-3 w-[1px] bg-white/10" />
      <div className="flex items-center gap-2">
        <Clock className="h-3 w-3 text-yellow-500" />
        <span className="text-muted-foreground">TRIAL:</span>
        <span className="text-yellow-500">24H DURATION</span>
      </div>
    </div>
  );
}
