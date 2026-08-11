import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Award, Star, Zap, Clock, Users, Gift, ChevronRight, CheckCircle2, Trophy, Flame, Loader2, Activity, ShieldAlert, ZapOff, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useSuspenseQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { getLoyaltyDashboard, claimMissionReward, getSystemStatus } from '@/lib/loyalty.functions';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { BackToDashboard } from "@/components/BackToDashboard";

export const Route = createFileRoute('/_authenticated/fidelidade')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ['loyalty-dashboard'],
      queryFn: () => getLoyaltyDashboard(),
    });
  },
  component: LoyaltyPage,
});

function MissionClaimButton({ missionId, isClaimed }: { missionId: string, isClaimed: boolean }) {
  const queryClient = useQueryClient();
  const claimFn = useServerFn(claimMissionReward);
  
  const mutation = useMutation({
    mutationFn: (vars: { missionId: string }) => claimFn({ data: vars }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.message || "Recompensa resgatada!");
        queryClient.invalidateQueries({ queryKey: ['loyalty-dashboard'] });
      } else {
        toast.error(res.message || "Falha ao resgatar.");
      }
    },
    onError: (e: any) => toast.error("Erro tático: " + e.message)
  });

  return (
    <Button 
      variant={isClaimed ? "secondary" : "outline"}
      size="sm" 
      disabled={isClaimed || mutation.isPending}
      className={cn(
        "h-7 text-[9px] font-mono uppercase mt-2",
        !isClaimed && "border-primary/30 hover:bg-primary/10"
      )}
      onClick={() => mutation.mutate({ missionId })}
    >
      {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : isClaimed ? "Resgatado" : "Resgatar"}
    </Button>
  );
}

function SystemStatusPanel() {
  const getStatus = useServerFn(getSystemStatus);
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => getStatus(),
    refetchInterval: 30000 // 30s
  });

  if (!status) return null;

  return (
    <Card className="border-primary/10 bg-card/20 backdrop-blur-md overflow-hidden relative mb-8">
      <div className="absolute top-0 right-0 p-2 opacity-5">
        <Activity className="h-16 w-16" />
      </div>
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-[10px] font-mono uppercase tracking-[0.2em] flex items-center gap-2">
            <ShieldAlert className="h-3 w-3 text-primary" /> Core Engine Diagnostics
          </CardTitle>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-muted-foreground hover:text-primary"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCcw className={cn("h-3 w-3", isLoading && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="py-2 px-4 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-[8px] font-mono uppercase text-muted-foreground">Database Uplink</p>
            <div className="flex items-center gap-2">
              <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", status.connection.status === 'healthy' ? "bg-green-500" : "bg-red-500")} />
              <span className="text-xs font-mono font-bold uppercase">{status.connection.status}</span>
              <span className="text-[9px] text-muted-foreground font-mono">{status.connection.latency}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[8px] font-mono uppercase text-muted-foreground">PostgREST Sync Cache</p>
            <div className="flex items-center gap-2">
              <Zap className={cn("h-3 w-3", parseInt(status.postgrest.failureRate) > 5 ? "text-yellow-500" : "text-primary")} />
              <span className="text-xs font-mono font-bold">{status.postgrest.failureRate} <span className="text-[8px] text-muted-foreground font-normal">fail rate</span></span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[8px] font-mono uppercase text-muted-foreground">Shadow Resilience</p>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span className="text-xs font-mono font-bold uppercase">{status.postgrest.totalRepairs} <span className="text-[8px] text-muted-foreground font-normal">auto-heals</span></span>
            </div>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-[8px] font-mono uppercase text-muted-foreground">Last Protocol Reset</p>
            <p className="text-xs font-mono font-bold">
              {status.postgrest.lastRepair 
                ? formatDistanceToNow(new Date(status.postgrest.lastRepair), { addSuffix: true, locale: ptBR })
                : "Nenhum reparo necessário"}
            </p>
          </div>
        </div>
        
        {status.recentIncidents.length > 0 && (
          <div className="mt-4 pt-3 border-t border-primary/10">
            <p className="text-[8px] font-mono uppercase text-muted-foreground mb-2">Logs de Telemetria Recentes</p>
            <div className="space-y-1">
              {status.recentIncidents.map((incident: any) => (
                <div key={incident.id} className="flex items-center justify-between text-[9px] font-mono text-muted-foreground/80 hover:text-foreground transition-colors">
                  <span className="flex items-center gap-2">
                    {incident.recovered ? <Zap className="h-2.5 w-2.5 text-green-500" /> : <ZapOff className="h-2.5 w-2.5 text-red-500" />}
                    [SYNC_ERR] AT {incident.context.toUpperCase()}
                  </span>
                  <span>{new Date(incident.time).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LoyaltyPage() {
  const { data } = useSuspenseQuery({
    queryKey: ['loyalty-dashboard'],
    queryFn: () => getLoyaltyDashboard(),
  });

  const { loyalty, currentTier, nextTier, missions, history, rewards, profile } = data as any;

  const progress = nextTier 
    ? Math.min(100, (loyalty.points / nextTier.min_points) * 100) 
    : 100;

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <BackToDashboard />
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-4xl md:text-6xl font-display font-black tracking-tighter uppercase italic">
            Shadow <span className="text-primary underline decoration-primary decoration-4 underline-offset-8">Loyalty</span>
          </h1>
          <p className="text-muted-foreground mt-4 font-mono text-xs uppercase tracking-[0.2em]">
            // Professional Rewards & Member Status
          </p>
        </div>
        <div className="flex items-center gap-3 bg-card border border-primary/20 p-4 rounded-xl shadow-lg">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono">{loyalty.points.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Shadow Points</div>
          </div>
        </div>
      </header>

      <SystemStatusPanel />

      <div className="grid md:grid-cols-3 gap-6">
        {/* Tier Card */}
        <Card className="md:col-span-2 border-primary/20 bg-card/50 backdrop-blur-sm overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Award className="h-32 w-32 rotate-12" />
          </div>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-mono uppercase tracking-[0.2em] font-bold">
                {currentTier?.name || 'Starter'}
              </div>
              <span className="text-muted-foreground text-xs font-mono lowercase tracking-tighter">
                há {formatDistanceToNow(new Date(profile.created_at), { locale: ptBR })}
              </span>
            </div>
            <CardTitle className="text-2xl font-display uppercase tracking-tight">Status da sua Sombra</CardTitle>
            <CardDescription className="max-w-md">
              Você está no nível <span className="text-primary font-bold">{currentTier?.name}</span>. 
              {nextTier ? ` Faltam ${(nextTier.min_points - loyalty.points).toLocaleString()} pontos para o nível ${nextTier.name}.` : " Você atingiu o nível máximo da elite."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {nextTier && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  <span>Progresso para {nextTier.name}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2 bg-muted/30" />
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatItem icon={<Star className="h-4 w-4" />} label="Nível" value={currentTier?.name || 'Starter'} color="text-yellow-500" />
              <StatItem icon={<Zap className="h-4 w-4" />} label="Pontos" value={loyalty.points} color="text-primary" />
              <StatItem icon={<Clock className="h-4 w-4" />} label="Tempo" value={loyalty.days_active} suffix="d" color="text-blue-500" />
              <StatItem icon={<Users className="h-4 w-4" />} label="Convidou" value={profile.conversions_count || 0} color="text-green-500" />
            </div>
          </CardContent>
        </Card>

        {/* Benefits Card */}
        <Card className="border-border/40 bg-card/30">
          <CardHeader>
            <CardTitle className="text-lg font-display uppercase tracking-tight flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" /> Benefícios Atuais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {(currentTier?.benefits || []).map((benefit: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground group">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 group-hover:scale-110 transition-transform" />
                  <span>{benefit}</span>
                </li>
              ))}
              {(!currentTier?.benefits || currentTier.benefits.length === 0) && (
                <li className="text-xs text-muted-foreground font-mono">Nenhum benefício ativo.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Missions */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display uppercase tracking-tight flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" /> Missões Disponíveis
            </h2>
            <Button variant="ghost" size="sm" className="text-[10px] font-mono uppercase tracking-widest">
              Ver todas <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          <div className="grid gap-4">
            {missions.length > 0 ? missions.map((m: any) => {
              const isClaimed = history.some((h: any) => h.action_type === 'mission_complete' && h.reference_id === m.id);
              return (
                <Card key={m.id} className={cn("border-border/40 hover:border-primary/20 transition-colors group", isClaimed && "opacity-60 bg-muted/5")}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
                        isClaimed ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                      )}>
                        {isClaimed ? <CheckCircle2 className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm leading-none flex items-center gap-2">
                          {m.title}
                          {isClaimed && <Badge variant="outline" className="text-[8px] h-4 border-green-500/30 text-green-500 uppercase font-mono">Concluído</Badge>}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-primary font-mono font-bold text-sm">+{m.reward_points} pts</div>
                      <MissionClaimButton missionId={m.id} isClaimed={isClaimed} />
                    </div>
                  </CardContent>
                </Card>
              );
            }) : (
              <div className="text-center py-8 border border-dashed rounded-xl text-muted-foreground text-sm font-mono">
                Nenhuma missão disponível no momento.
              </div>
            )}
          </div>
        </div>

        {/* Recent History */}
        <div className="space-y-4">
          <h2 className="text-xl font-display uppercase tracking-tight flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" /> Histórico
          </h2>
          <div className="bg-card/50 rounded-xl border border-border/40 divide-y divide-border/40 overflow-hidden">
            {history.length > 0 ? history.map((h: any) => (
              <div key={h.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div>
                  <div className="text-xs font-bold leading-none">{h.description}</div>
                  <div className="text-[9px] text-muted-foreground mt-1 font-mono uppercase tracking-tighter">
                    {new Date(h.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className={`font-mono text-xs font-bold ${h.amount >= 0 ? 'text-primary' : 'text-red-500'}`}>
                  {h.amount >= 0 ? '+' : ''}{h.amount}
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-xs text-muted-foreground font-mono">
                Sem atividades recentes.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({ icon, label, value, color, suffix = "" }: { icon: React.ReactNode, label: string, value: any, color: string, suffix?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className={color}>{icon}</span>
        <span className="text-[9px] font-mono uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-sm font-bold font-mono tracking-tight">{value}{suffix}</div>
    </div>
  );
}
