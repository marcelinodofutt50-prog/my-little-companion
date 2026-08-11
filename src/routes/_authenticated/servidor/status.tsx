import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { 
  Server, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX, 
  Clock, 
  RefreshCcw, 
  Activity, 
  Zap,
  ChevronRight,
  Info,
  CheckCircle2, 
  Check,
  AlertCircle, 

  FileSearch,
  History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getServerStatus, type ServerStatus } from "@/lib/server-status.functions";
import { getAuditLogs } from "@/lib/audit.functions";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_authenticated/servidor/status")({
  head: () => ({ meta: [{ title: "Status do Servidor — Shadow" }] }),
  component: ServerStatusPage,
});

function ServerStatusPage() {
  const [statuses, setStatuses] = useState<ServerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  const fetchStatus = useServerFn(getServerStatus);
  const fetchAudit = useServerFn(getAuditLogs);

  async function refresh() {
    setLoading(true);
    try {
      const [statusData, auditData] = await Promise.all([
        fetchStatus(),
        fetchAudit()
      ]);
      setStatuses(statusData);
      setAuditLogs(auditData);
      setLastUpdate(new Date());
    } catch (e: any) {
      toast.error("Falha ao consultar dados da infraestrutura");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000); // Frequência real: a cada 10 segundos
    return () => clearInterval(id);
  }, []);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              <h1 className="font-display text-sm font-bold uppercase tracking-wider">Infraestrutura Shadow</h1>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              {lastUpdate && (
                <span className="font-mono text-[9px] text-muted-foreground uppercase">
                  Sincronizado: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={refresh} 
                disabled={loading}
                className="h-8 w-8 p-0"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl p-6">
            <div className="mb-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// monitoramento global</div>
              <h2 className="mt-1 font-display text-3xl font-bold">Status dos Servidores</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Acompanhe em tempo real a integridade das nossas VPS de processamento Shadow 4.5 e 4.6.
              </p>
            </div>

            <div className="grid gap-6">
              {loading && statuses.length === 0 ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-32 w-full animate-pulse rounded-xl border border-border/40 bg-card/20" />
                ))
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {statuses.map((s) => (
                    <StatusCard key={s.panel} status={s} />
                  ))}
                </div>
              )}
            </div>

            <section className="mt-12">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 font-display text-lg font-bold">
                    <FileSearch className="h-4 w-4 text-primary" /> Auditoria de Decisões
                  </h3>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-mono mt-1">
                    Histórico de verificações e elegibilidade
                  </p>
                </div>
                <History className="h-5 w-5 text-muted-foreground/30" />
              </div>

              <div className="overflow-hidden rounded-xl border border-border/40 bg-card/20">
                <div className="grid grid-cols-4 border-b border-border/40 bg-background/40 p-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  <div>Evento</div>
                  <div>Decisão</div>
                  <div>Justificativa</div>
                  <div className="text-right">Horário</div>
                </div>
                <div className="divide-y divide-border/20">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="grid grid-cols-4 items-center p-3 text-[11px] transition-colors hover:bg-primary/5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                        <span className="font-bold">{log.event}</span>
                      </div>
                      <div>
                        <span className={`rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          log.decision === 'APPROVED' || log.decision === 'SUCCESS' 
                            ? 'bg-neon/20 text-neon' 
                            : log.decision === 'PENDING' 
                            ? 'bg-amber-400/20 text-amber-400' 
                            : 'bg-destructive/20 text-destructive'
                        }`}>
                          {log.decision}
                        </span>
                      </div>
                      <div className="text-muted-foreground italic">
                        {log.reason}
                      </div>
                      <div className="text-right font-mono text-[10px] text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                  {auditLogs.length === 0 && !loading && (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      Nenhum registro de auditoria encontrado para esta conta.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-12">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 font-display text-lg font-bold">
                    <Zap className="h-4 w-4 text-primary" /> Notificações do Shadow
                  </h3>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-mono mt-1">
                    Alertas de status via e-mail e webhook
                  </p>
                </div>
              </div>

              <NotificationSettings />
            </section>

            <section className="mt-12 space-y-6">
              <div className="border-t border-border/40 pt-8">
                <h3 className="flex items-center gap-2 font-display text-lg font-bold">
                  <Activity className="h-4 w-4 text-primary" /> Critérios de Aprovação & SLA
                </h3>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <CriteriaItem 
                    title="Tempo de Resposta" 
                    desc="Servidores operando abaixo de 300ms são considerados em estado ideal (Verde)." 
                    status="optimal"
                  />
                  <CriteriaItem 
                    title="Latência de Provisionamento" 
                    desc="A criação de licenças e acesso ao servidor é aprovada instantaneamente após o PIX." 
                    status="optimal"
                  />
                  <CriteriaItem 
                    title="Bypass em Tempo Real" 
                    desc="O status 'Online' garante que o Shadow Protocol está ativo e injetando o dropper corretamente." 
                    status="optimal"
                  />
                  <CriteriaItem 
                    title="Conexão com Painel Yaarsa" 
                    desc="Se o painel estiver 'Offline', a criação de novos usuários é pausada até a restauração." 
                    status="warning"
                  />
                </div>
              </div>

              <div className="border-t border-border/40 pt-8">
                <h3 className="flex items-center gap-2 font-display text-lg font-bold">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Integridade de Dados
                </h3>
                <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-mono mt-1 mb-4">
                  Validação automática de preços e conformidade
                </p>
                <div className="rounded-xl border border-border/40 bg-card/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Auditoria de Preços UI vs DB</span>
                    <span className="flex items-center gap-1.5 rounded-full bg-neon/20 px-2 py-0.5 text-[9px] font-bold text-neon uppercase">
                      <Check className="h-2.5 w-2.5" /> Sincronizado
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Mecanismo de validação automática ativo. O sistema verifica periodicamente se os preços exibidos nos planos e checkout 
                    conferem exatamente com os valores oficiais no banco de dados (R$ 250 Mensal, R$ 1.800 Vitalício, R$ 450 Trial).
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Info className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-primary">O que fazer se um servidor estiver Offline?</h4>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      Nossa infraestrutura possui redundância. Se a sua versão (ex: 4.5.7) estiver com latência alta, 
                      as funções de Play Protect Builder ainda podem funcionar via Bypass Play Protect 4.6. 
                      Para erros de login "803" ou "Licença Expirada" com servidor Online, utilize o botão de correção no Dashboard.
                    </p>
                    <div className="mt-4 flex gap-3">
                      <Button variant="outline" size="sm" className="font-mono text-[10px] uppercase">Ver Logs de Erro</Button>
                      <Link to="/suporte">
                        <Button variant="outline" size="sm" className="font-mono text-[10px] uppercase">Falar com Técnico</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function StatusCard({ status }: { status: ServerStatus }) {
  const isOnline = status.status === "online";
  const isError = status.status === "error";
  
  return (
    <div className={`enterprise-surface group relative overflow-hidden p-5 transition-all hover:border-primary/50 shadow-sm ${
      !isOnline ? "border-destructive/30" : ""
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${
            isOnline ? "bg-[#00ff9d] animate-pulse shadow-[0_0_8px_rgba(0,255,157,0.8)]" : 
            isError ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.6)]"
          }`} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {status.panel.toUpperCase()}
          </span>
        </div>
        {isOnline && status.latency_ms && (
          <span className="font-mono text-[10px] text-[#00ff9d]">
            {status.latency_ms}ms
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="osint-label mb-1 text-muted-foreground">HOST</div>
          <div className="font-mono text-sm font-bold truncate max-w-[150px]">{status.host}</div>
        </div>
        <div className="text-right">
          <div className="osint-label mb-1 text-muted-foreground">STATUS</div>
          <div className={`font-display text-lg font-black uppercase tracking-tighter ${
            isOnline ? "text-[#00ff9d]" : isError ? "text-amber-400" : "text-destructive"
          }`}>
            {status.status}
          </div>
        </div>
      </div>
      
      {status.message && (
        <div className="mt-3 border-t border-border/20 pt-2 font-mono text-[9px] text-muted-foreground italic">
          // {status.message}
        </div>
      )}

      {!isOnline && (
        <div className="absolute inset-0 bg-destructive/5 pointer-events-none" />
      )}
    </div>
  );
}

function CriteriaItem({ title, desc, status }: { title: string, desc: string, status: "optimal" | "warning" | "critical" }) {
  const Icon = status === "optimal" ? CheckCircle2 : status === "warning" ? AlertCircle : ShieldX;
  const color = status === "optimal" ? "text-neon" : status === "warning" ? "text-amber-400" : "text-destructive";
  
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/20 p-4">
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${color}`} />
      <div>
        <div className="text-xs font-bold uppercase tracking-wider">{title}</div>
        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
          {desc}
        </p>
      </div>
    </div>
  );
}

import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getNotificationSettings, updateNotificationSettings, testWebhook } from "@/lib/notifications.functions";

function NotificationSettings() {
  const fetchSettings = useServerFn(getNotificationSettings);
  const updateSettings = useServerFn(updateNotificationSettings);
  const triggerTest = useServerFn(testWebhook);
  
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSettings().then(setSettings);
  }, []);

  if (!settings) return <div className="h-32 animate-pulse rounded-xl border border-border/40 bg-card/20" />;

  const handleToggle = async (key: string) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    try {
      await updateSettings(newSettings);
      toast.success("Preferências atualizadas");
    } catch (e) {
      toast.error("Erro ao salvar preferências");
    }
  };

  const handleWebhookTest = async () => {
    if (!settings.webhook_url) return toast.error("Insira uma URL de Webhook");
    setLoading(true);
    try {
      await triggerTest({ data: { url: settings.webhook_url } });
      toast.success("Notificação de teste enviada com sucesso");
    } catch (e) {
      toast.error("Falha no envio do webhook");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 rounded-xl border border-border/40 bg-card/10 p-6">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/20 bg-background/40 p-3">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Notificações por E-mail</Label>
              <p className="text-[10px] text-muted-foreground">Receba alertas diretamente no seu e-mail cadastrado.</p>
            </div>
            <Switch checked={settings.email_enabled} onCheckedChange={() => handleToggle('email_enabled')} />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/20 bg-background/40 p-3">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Webhook de Servidor</Label>
              <p className="text-[10px] text-muted-foreground">Integre alertas com Discord ou servidores externos.</p>
            </div>
            <Switch checked={settings.webhook_enabled} onCheckedChange={() => handleToggle('webhook_enabled')} />
          </div>

          {settings.webhook_enabled && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              <Label className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Endpoint URL</Label>
              <div className="flex gap-2">
                <Input 
                  value={settings.webhook_url} 
                  onChange={(e) => setSettings({...settings, webhook_url: e.target.value})}
                  placeholder="https://discord.com/api/webhooks/..." 
                  className="h-9 font-mono text-xs bg-background/50"
                />
                <Button variant="outline" size="sm" onClick={handleWebhookTest} disabled={loading} className="h-9 px-3 text-[10px] uppercase font-mono">
                  Testar
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        <div className="space-y-3">
          <Label className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Eventos Notificados</Label>
          
          <div className="space-y-2">
            {[
              { id: 'notify_on_approval', label: 'Acesso Aprovado', desc: 'Alertar quando a elegibilidade for confirmada.' },
              { id: 'notify_on_pending', label: 'Acesso Pendente', desc: 'Alertar sobre necessidade de ação manual.' },
              { id: 'notify_on_denial', label: 'Acesso Negado', desc: 'Alertar com justificativa do sistema.' },
              { id: 'notify_on_server_release', label: 'Servidor Liberado', desc: 'Notificar após liberação (Pagamento + Elegibilidade), incluindo data e Ref.' }

            ].map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-4 rounded-lg border border-border/20 bg-background/20 p-2.5">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-tight">{event.label}</div>
                  <p className="text-[9px] text-muted-foreground">{event.desc}</p>
                </div>
                <Switch checked={settings[event.id]} onCheckedChange={() => handleToggle(event.id)} className="scale-75" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
