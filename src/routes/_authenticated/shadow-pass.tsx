import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Trophy, Users, Award, Gift, Diamond, Shield, Bell, 
  ChevronRight, CheckCircle2, Star, Zap, Clock, TrendingUp,
  Lock, ExternalLink, Info, BadgeCheck, Heart, Edit2, Save, X, Ghost, UserCircle, Send, MessageSquare, RefreshCw, Activity, Database, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSuspenseQuery, useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { getShadowPassData } from '@/lib/shadow-core.functions';
import { updateProfileCustomization } from '@/lib/profile-customization.functions';
import { getCommunityMessages, sendCommunityMessage, deleteCommunityMessage } from '@/lib/community.functions';
import { uploadAvatar } from '@/lib/avatar.functions';
import { getDiagnosticData, triggerManualSchemaRefresh } from '@/lib/diagnostics.functions';
import { claimMissionReward } from '@/lib/loyalty.functions';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generateTrial } from '@/lib/license.functions';
import { getDeviceSignature } from '@/lib/device-signature';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BackToDashboard } from "@/components/BackToDashboard";

export const Route = createFileRoute('/_authenticated/shadow-pass')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ['shadow-pass-data'],
      queryFn: () => getShadowPassData(),
    });
  },
  component: ShadowPassPage,
});

function ShadowPassPage() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery({
    queryKey: ['shadow-pass-data'],
    queryFn: () => getShadowPassData(),
  });

  const [messageText, setMessageText] = useState("");
  const fetchMessages = useServerFn(getCommunityMessages);
  const sendMsgFn = useServerFn(sendCommunityMessage);
  const deleteMsgFn = useServerFn(deleteCommunityMessage);

  const { data: nexus, isLoading: nexusLoading, isError: nexusError, refetch: refetchNexus } = useQuery({
    queryKey: ['community-messages'],
    queryFn: () => fetchMessages({}),
    refetchInterval: 5000,
    retry: 1,
  });

  const claimRewardFn = useServerFn(claimMissionReward);

  const messages = (nexus?.messages ?? []) as any[];
  const nexusOnline = nexus?.online ?? 0;
  const nexusFault = nexusError || !!nexus?.error;


  const sendMessageMutation = useMutation({
    mutationFn: (vars: { content: string }) => sendMsgFn({ data: vars }),
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ['community-messages'] });
    },
    onError: (e: any) => {
      console.error("Mutation Error:", e);
      toast.error("Falha ao enviar: " + e.message);
    }
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (vars: { id: string }) => deleteMsgFn({ data: vars }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-messages'] }),
    onError: (e: any) => toast.error("Falha ao apagar: " + e.message),
  });



  const updateProfileFn = useServerFn(updateProfileCustomization);
  const mutation = useMutation({
    mutationFn: (vars: any) => updateProfileFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shadow-pass-data'] });
      queryClient.invalidateQueries({ queryKey: ['my-identity'] });
      queryClient.invalidateQueries({ queryKey: ['community-messages'] });
      toast.success("Perfil atualizado!");
      setIsEditing(false);
    },
    onError: (e: any) => {
      console.error("Profile Update Error:", e);
      toast.error("Falha ao atualizar: " + e.message);
    }
  });

  const { identity, loyalty, community, vip, reputation, staff } = data as any;
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(identity.nickname);
  const [isAnonymous, setIsAnonymous] = useState(!!(identity.isAnonymous || identity.metadata?.is_anonymous));
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);

  // Mantém o campo de edição sincronizado quando os dados do servidor chegam/atualizam.
  useEffect(() => {
    if (!isEditing) setEditName(identity.nickname || "");
  }, [identity.nickname, isEditing]);

  const handleSave = () => {
    mutation.mutate({ nickname: editName, is_anonymous: isAnonymous });
  };

  const uploadAvatarFn = useServerFn(uploadAvatar);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito pesada (máx 2MB)");
      return;
    }

    const uploadToast = toast.loading("Enviando imagem tática...");

    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo"));
        reader.readAsDataURL(file);
      });

      // Upload via servidor: evita bloqueios de RLS no storage do navegador.
      const res: any = await uploadAvatarFn({
        data: { dataUrl, contentType: file.type || "image/png" },
      });

      if (res?.url) setAvatarOverride(`${res.url}?t=${Date.now()}`);
      await queryClient.invalidateQueries({ queryKey: ['shadow-pass-data'] });
      queryClient.invalidateQueries({ queryKey: ['my-identity'] });
      queryClient.invalidateQueries({ queryKey: ['community-messages'] });
      toast.success("Avatar atualizado com sucesso!", { id: uploadToast });
      return res;
    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast.error("Falha no upload: " + (error?.message || "erro desconhecido"), { id: uploadToast });
    } finally {
      e.target.value = "";
    }
  };


  const [showDiag, setShowDiag] = useState(false);
  const getDiagFn = useServerFn(getDiagnosticData);
  const refreshSchemaFn = useServerFn(triggerManualSchemaRefresh);

  const { data: diagInfo, refetch: refetchDiag, isFetching: isFetchingDiag } = useQuery({
    queryKey: ['profile-diagnostics'],
    queryFn: () => getDiagFn(),
    enabled: showDiag
  });

  const handleManualRefresh = async () => {
    toast.loading("Disparando atualização forçada...", { id: 'refresh-schema' });
    try {
      await refreshSchemaFn();
      toast.success("Comando enviado! O cache do PostgREST deve atualizar em instantes.", { id: 'refresh-schema' });
      setTimeout(() => refetchDiag(), 2000);
    } catch (e: any) {
      toast.error("Falha ao atualizar: " + e.message, { id: 'refresh-schema' });
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500 max-w-6xl pb-24 md:pb-8 overflow-x-hidden">
      <BackToDashboard />

      {/* Header Profile */}
      <header className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-primary/20 bg-card p-5 md:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <Shield className="h-64 w-64 rotate-12" />
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 relative z-10">
          <div className="relative shrink-0 group">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full group-hover:bg-primary/40 transition-colors" />
            <Avatar className="h-20 w-20 md:h-32 md:w-32 border-4 border-primary shadow-2xl relative cursor-pointer hover:scale-105 transition-transform overflow-hidden" onClick={() => fileRef.current?.click()}>
              <AvatarImage
                src={avatarOverride || identity.avatar || (identity.metadata as any)?.avatar_url || undefined}
                className="object-cover"
              />
              <AvatarFallback className="bg-muted text-2xl md:text-4xl">
                {isAnonymous ? <Ghost className="h-12 w-12 text-primary" /> : (identity.nickname || identity.display_name || "?")?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
              {/* Upload Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Edit2 className="h-6 w-6 text-white" />
              </div>
            </Avatar>
            <input 
              type="file" 
              ref={fileRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleAvatarUpload}
            />
            {vip.tier !== 'none' && vip.tier !== undefined && (
              <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tighter border-2 border-card shadow-lg">
                {vip.tier}
              </div>
            )}
          </div>
          
          <div className="flex-1 text-center md:text-left space-y-2 md:space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              {isEditing ? (
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Input 
                    value={editName} 
                    onChange={e => setEditName(e.target.value)}
                    className="h-10 w-full md:w-64 bg-background/50 border-primary/30"
                    placeholder="Seu codinome..."
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-500 shrink-0" onClick={handleSave} disabled={mutation.isPending}>
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => setIsEditing(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl md:text-5xl font-black tracking-tighter uppercase italic break-all">
                    {isAnonymous ? "Membro Anônimo" : identity.nickname}
                  </h1>
                  <Button size="icon" variant="ghost" className="h-6 w-6 opacity-40 hover:opacity-100" onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            
            <p className="text-muted-foreground text-sm md:text-base font-medium flex items-center justify-center md:justify-start gap-2">
              {isAnonymous ? (
                <span className="flex items-center gap-1.5 text-primary/80 uppercase font-mono text-[10px] tracking-widest">
                  <Ghost className="h-4 w-4" /> Identidade Oculta
                </span>
              ) : (
                <>
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  <span className="uppercase font-mono text-[10px] tracking-widest">
                    Desde {formatDistanceToNow(new Date(identity.joinedAt), { addSuffix: true, locale: ptBR })}
                  </span>
                </>
              )}
            </p>
            
            <div className="flex items-center justify-center md:justify-start gap-2 pt-2">
               <Button 
                variant="outline" 
                size="sm" 
                className={cn("h-7 text-[10px] uppercase font-bold tracking-widest", isAnonymous ? "border-primary bg-primary/10" : "border-muted-foreground/20")}
                onClick={() => {
                  const nextAnon = !isAnonymous;
                  setIsAnonymous(nextAnon);
                  mutation.mutate({ is_anonymous: nextAnon });
                }}
              >
                {isAnonymous ? <UserCircle className="mr-1 h-3 w-3" /> : <Ghost className="mr-1 h-3 w-3" />}
                {isAnonymous ? "Revelar Identidade" : "Tornar-se Anônimo"}
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 shrink-0">
                <Trophy className="h-4 w-4 text-primary" />
                <span className="text-[10px] md:text-xs font-bold font-mono uppercase tracking-tighter">{loyalty.tier}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 shrink-0">
                <Diamond className="h-4 w-4 text-yellow-500" />
                <span className="text-[10px] md:text-xs font-bold font-mono uppercase tracking-tighter">{vip.tier.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 shrink-0">
                <Shield className="h-4 w-4 text-blue-500" />
                <span className="text-[10px] md:text-xs font-bold font-mono uppercase tracking-tighter">Rep: {reputation.score}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Tabs */}
      <Tabs defaultValue="progress" className="w-full space-y-6 md:space-y-8">
        <TabsList className="w-full justify-start overflow-x-auto bg-transparent border-b border-border/40 rounded-none h-auto p-0 gap-8 mb-4">
          <TabsTrigger 
            value="progress" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent font-mono text-[10px] uppercase tracking-widest px-0 pb-4"
          >
            Progresso & Nexus
          </TabsTrigger>
          <TabsTrigger 
            value="missions" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent font-mono text-[10px] uppercase tracking-widest px-0 pb-4"
          >
            Missões Shadow
          </TabsTrigger>
          <TabsTrigger 
            value="vip-benefits" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent font-mono text-[10px] uppercase tracking-widest px-0 pb-4"
          >
            Benefícios VIP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="m-0">
          <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
            {/* Left Column: Progress & Community */}
            <div className="lg:col-span-2 space-y-6 md:space-y-8">
          {/* Progress Overview */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-display uppercase tracking-tight flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" /> Evolução de Carreira e Missões
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Loyalty Progress */}
              <Card className="border-primary/10 bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] md:text-sm font-mono uppercase tracking-widest text-muted-foreground flex justify-between items-center">
                    Loyalty Level <span className="text-primary font-bold">{Math.round(loyalty.progress)}%</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={loyalty.progress} className="h-2" />
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold">{loyalty.tier}</span>
                    <span className="text-muted-foreground truncate ml-2">Próximo: {loyalty.nextTier || 'Max'}</span>
                  </div>
                  <div className="pt-2 border-t border-border/40 flex justify-between items-center">
                    <div className="text-center">
                      <div className="text-lg font-bold font-mono">{loyalty.points}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Points</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold font-mono">{loyalty.daysActive}d</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Active</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* VIP Progress (Shadow Protocol v22.0 Evolution) */}
              <Card className="border-yellow-500/10 bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] md:text-sm font-mono uppercase tracking-widest text-muted-foreground flex justify-between items-center">
                    Progressão VIP <span className="text-yellow-500 font-bold">{vip.tier === 'elite' ? 'MAX' : `${Math.round(vip.progress || 0)}%`}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={vip.tier === 'elite' ? 100 : Math.round(vip.progress || 0)} className="h-2 bg-yellow-500/10 [&>div]:bg-yellow-500" />
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn(
                        "text-[9px] uppercase font-bold border-yellow-500/30",
                        vip.tier === 'elite' ? "bg-yellow-500 text-black" : "text-yellow-500"
                      )}>
                        {vip.tier.toUpperCase()}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground text-[10px] font-mono uppercase">
                      Próximo Nível: {vip.next?.tier?.toUpperCase() || 'SOBERANO'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="p-2 rounded bg-black/20 border border-white/5 text-center">
                      <div className="text-xs font-bold text-yellow-500 font-mono">{loyalty.points}</div>
                      <div className="text-[8px] text-muted-foreground uppercase font-mono">XP Total</div>
                    </div>
                    <div className="p-2 rounded bg-black/20 border border-white/5 text-center">
                      <div className="text-xs font-bold text-primary font-mono">{reputation.score}</div>
                      <div className="text-[8px] text-muted-foreground uppercase font-mono">Reputação</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Community Goals */}
          <section className="space-y-4">
            <h2 className="text-xl font-display uppercase tracking-tight flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Community Goals
            </h2>
            <Card className="border-primary/10 bg-card/50 overflow-hidden">
              <CardContent className="p-6 space-y-8">
                {/* Active Goal */}
                {(() => {
                  const nextGoal = community.goals.find((g: any) => !g.achieved_at);
                  const achievedGoals = community.goals.filter((g: any) => g.achieved_at).length;
                  const totalGoals = community.goals.length;
                  const progress = nextGoal ? (community.memberCount / nextGoal.target_members) * 100 : 100;

                  return (
                    <>
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                          <div>
                            <div className="text-sm font-mono uppercase text-primary mb-1">Meta Atual</div>
                            <h3 className="text-xl md:text-2xl font-bold font-mono truncate">{community.memberCount} / {nextGoal?.target_members || '???'} Membros</h3>
                          </div>
                          <div className="text-left sm:text-right w-full sm:w-auto">
                            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Status</div>
                            <Badge className="bg-primary/20 text-primary border-primary/30 shrink-0">{achievedGoals}/{totalGoals} Concluídas</Badge>
                          </div>
                        </div>
                        <Progress value={progress} className="h-3" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Próxima Recompensa</div>
                            <div className="text-[13px] font-bold flex items-center gap-2"><Gift className="h-4 w-4 text-primary shrink-0" /> <span className="truncate">{nextGoal?.reward_description}</span></div>
                          </div>
                          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                            <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Benefício Adicional</div>
                            <div className="text-[13px] font-bold flex items-center gap-2"><Star className="h-4 w-4 text-primary shrink-0" /> <span className="truncate">{nextGoal?.benefit_description}</span></div>
                          </div>
                        </div>
                      </div>

                      {/* Goal Timeline */}
                      <div className="space-y-4">
                        <div className="text-sm font-mono uppercase text-muted-foreground tracking-widest">Histórico de Conquistas</div>
                        <div className="grid gap-3">
                          {community.goals.map((goal: any) => (
                            <div key={goal.id} className={cn(
                              "flex items-center justify-between p-3 rounded-xl border transition-all",
                              goal.achieved_at ? "bg-green-500/5 border-green-500/20" : "bg-muted/10 border-border/40 opacity-50"
                            )}>
                              <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                                <div className={cn(
                                  "h-8 w-8 rounded-full flex items-center justify-center",
                                  goal.achieved_at ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"
                                )}>
                                  {goal.achieved_at ? <CheckCircle2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-bold truncate">{goal.target_members} Membros</div>
                                  <div className="text-[10px] text-muted-foreground font-mono truncate">{goal.reward_description}</div>
                                </div>
                              </div>
                              {goal.achieved_at && (
                                <div className="text-[9px] font-mono text-green-500 uppercase">Resgatado</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base uppercase">
                      <Gift className="h-5 w-5 text-primary" /> {community.giveaway.title}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      5 membros válidos serão sorteados: 1 Vitalício, 2 Mensais e 2 Semanais.
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {community.giveaway.status === "completed" ? "Concluído" : "Em andamento"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {community.giveaway.status === "completed" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {community.giveaway.winners.map((winner: any) => (
                      <div key={winner.position} className={cn(
                        "flex items-center gap-3 rounded-lg border p-3",
                        winner.isCurrentUser ? "border-primary bg-primary/10" : "border-border/50 bg-muted/10",
                      )}>
                        <Award className="h-5 w-5 text-primary" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold">{winner.nickname}</div>
                          <div className="text-[10px] uppercase text-muted-foreground">
                            {winner.prize_kind === "lifetime" ? "Licença Vitalícia" : winner.prize_kind === "monthly" ? "Licença Mensal" : "Licença Semanal"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span>{community.giveaway.eligibleCount} membros elegíveis</span>
                      <span>{community.giveaway.milestone}</span>
                    </div>
                    <Progress
                      value={Math.min(100, (community.giveaway.eligibleCount / community.giveaway.milestone) * 100)}
                      className="h-3"
                    />
                    <p className="text-xs text-muted-foreground">
                      Contas da equipe, bloqueadas ou marcadas por fraude não participam.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Diagnóstico de Infraestrutura (Botão Discreto) */}
          <div className="flex justify-center pt-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowDiag(!showDiag)}
              className="text-[9px] uppercase font-mono tracking-[0.3em] opacity-30 hover:opacity-100 transition-opacity"
            >
              <Activity className="h-3 w-3 mr-2" /> 
              {showDiag ? "Ocultar Diagnóstico Shadow" : "Executar Diagnóstico Shadow"}
            </Button>
          </div>

          <AnimatePresence>
            {showDiag && (
              <motion.section
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <Card className="border-orange-500/20 bg-orange-500/5 backdrop-blur-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-mono uppercase tracking-widest flex items-center gap-2 text-orange-500">
                      <Database className="h-4 w-4" /> Relatório de Integridade de Schema
                    </CardTitle>
                    <CardDescription className="text-[10px] uppercase font-mono opacity-50">
                      Verificação técnica das colunas do sistema Shadow Core
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isFetchingDiag ? (
                      <div className="flex items-center gap-2 text-[10px] font-mono text-orange-500/70">
                        <RefreshCw className="h-3 w-3 animate-spin" /> Escaneando tabelas...
                      </div>
                    ) : diagInfo ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div className={cn(
                            "p-3 rounded-xl border flex flex-col gap-1",
                            (diagInfo as any).success && (diagInfo as any).data && 'metadata' in (diagInfo as any).data 
                              ? "bg-green-500/5 border-green-500/20" 
                              : "bg-red-500/5 border-red-500/20"
                          )}>
                            <span className="text-[9px] uppercase font-mono opacity-50">Coluna: metadata</span>
                            <span className="text-xs font-bold font-mono">
                              {(diagInfo as any).success && (diagInfo as any).data && 'metadata' in (diagInfo as any).data ? "DISPONÍVEL" : "NÃO ENCONTRADA"}
                            </span>
                          </div>
                          
                          <div className={cn(
                            "p-3 rounded-xl border flex flex-col gap-1",
                            (diagInfo as any).success && (diagInfo as any).data && 'vip_tier' in (diagInfo as any).data 
                              ? "bg-green-500/5 border-green-500/20" 
                              : "bg-red-500/5 border-red-500/20"
                          )}>
                            <span className="text-[9px] uppercase font-mono opacity-50">Coluna: vip_tier</span>
                            <span className="text-xs font-bold font-mono">
                              {(diagInfo as any).success && (diagInfo as any).data && 'vip_tier' in (diagInfo as any).data ? "DISPONÍVEL" : "NÃO ENCONTRADA"}
                            </span>
                          </div>
                        </div>

                        {(!(diagInfo as any).success || !(diagInfo as any).data || !('metadata' in (diagInfo as any).data)) && (
                          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-red-500 uppercase">Inconsistência Detectada</p>
                              <p className="text-[9px] leading-relaxed text-red-400">
                                O cache do PostgREST (PGRST108) está obsoleto. As colunas existem fisicamente no banco, mas a API ainda não as reconheceu.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-4 pt-2">
                          <div className="text-[8px] font-mono opacity-30 uppercase">
                            LAST_SCAN: {(diagInfo as any).timestamp}
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleManualRefresh}
                            className="h-7 text-[9px] uppercase font-mono tracking-tighter border-orange-500/30 hover:bg-orange-500/10 text-orange-500"
                          >
                            <RefreshCw className="h-3 w-3 mr-1.5" /> Forçar Refresh de Schema
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono text-red-500">
                        Falha ao obter dados de diagnóstico.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Mini Comunidade Anônima */}
          <section className="space-y-4">
            <h2 className="text-xl font-display uppercase tracking-tight flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> Shadow Nexus
              <Badge variant="outline" className="text-[9px] border-primary/20 text-primary/60">
                {nexusOnline} ativos
              </Badge>
            </h2>
            <Card className="border-primary/10 bg-card/50 overflow-hidden">
              <CardContent className="p-0 flex flex-col h-[400px]">
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4 custom-scrollbar flex flex-col-reverse">
                  {nexusFault ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2">
                      <Ghost className="h-8 w-8 opacity-50" />
                      <p className="text-[10px] font-mono uppercase tracking-widest">Canal instável</p>
                      <Button size="sm" variant="outline" onClick={() => refetchNexus()}>Reconectar</Button>
                    </div>
                  ) : nexusLoading ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground opacity-50">
                      <p className="text-[10px] font-mono uppercase tracking-widest">Conectando ao canal...</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
                      <Ghost className="h-8 w-8" />
                      <p className="text-[10px] font-mono uppercase tracking-widest">Silêncio no vácuo...</p>
                    </div>
                  ) : (
                    messages.map((msg: any) => (
                      <div key={msg.id} className="flex flex-col space-y-1 group">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-primary uppercase font-mono tracking-tighter">
                            {msg.author}
                          </span>
                          {msg.vip && msg.vip !== 'none' && (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 border-primary/30 text-primary uppercase">
                              {msg.vip}
                            </Badge>
                          )}
                          <span className="text-[8px] text-muted-foreground font-mono">
                            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                          {msg.isMine && (
                            <button
                              type="button"
                              onClick={() => deleteMessageMutation.mutate({ id: msg.id })}
                              className="text-[8px] text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity font-mono uppercase"
                            >
                              apagar
                            </button>
                          )}
                        </div>
                        <div className="bg-primary/5 border border-primary/10 rounded-2xl rounded-tl-none px-3 py-2 text-xs leading-relaxed max-w-[90%] break-words">
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>


                
                <div className="p-4 border-t border-primary/10 bg-black/20">
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (messageText.trim()) {
                        sendMessageMutation.mutate({ content: messageText });
                      }
                    }}
                    className="flex gap-2"
                  >
                    <Input 
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Transmissão criptografada..."
                      className="h-9 text-xs bg-background/50 border-primary/20 focus:border-primary/40"
                      disabled={sendMessageMutation.isPending}
                    />
                    <Button 
                      size="icon" 
                      className="h-9 w-9 shrink-0" 
                      disabled={sendMessageMutation.isPending || !messageText.trim()}
                    >
                      {sendMessageMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </form>
                  <p className="mt-2 text-[8px] font-mono uppercase text-muted-foreground/60 text-center tracking-widest">
                    O anonimato é garantido pelo protocolo Shadow Core
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>

        <div className="space-y-6 md:space-y-8">
          {/* Reputation Score */}
          <section className="space-y-4">
            <h2 className="text-xl font-display uppercase tracking-tight flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Reputation
            </h2>
            <Card className="border-primary/20 bg-card/50 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
              <CardContent className="p-6 text-center space-y-4">
                <div className="relative inline-flex items-center justify-center">
                   <svg className="h-32 w-32 -rotate-90">
                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-muted/20" />
                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" 
                      strokeDasharray={364.4} strokeDashoffset={364.4 * (1 - reputation.score / 100)} 
                      strokeLinecap="round" className="text-primary transition-all duration-1000" 
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold font-mono">{reputation.score}</span>
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">Score</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Sua reputação é calculada automaticamente com base no histórico e comportamento da sua conta.
                </p>
                <Badge variant="outline" className="text-[9px] font-mono uppercase text-primary border-primary/30 shrink-0">CONTA CONFIÁVEL</Badge>
              </CardContent>
            </Card>
          </section>

          {/* Staff Eligibility */}
          <section className="space-y-4">
            <h2 className="text-xl font-display uppercase tracking-tight flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-primary" /> Staff Program
            </h2>
            <Card className="border-primary/10 bg-card/50">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-3">
                  <CriteriaItem label="Loyalty Tier: GOLD" met={staff.criteria.loyalty} />
                  <CriteriaItem label="Reputation: 90+" met={staff.criteria.reputation} />
                  <CriteriaItem label="Account: 6+ months" met={staff.criteria.seniority} />
                  <CriteriaItem label="Conversions: 10+" met={staff.criteria.conversions} />
                </div>
                
                <div className="pt-4 border-t border-border/40">
                  {staff.isEligible ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-green-500 bg-green-500/5 p-3 rounded-xl border border-green-500/20">
                         <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                         <span className="text-xs font-bold uppercase tracking-tight">Candidatura disponível</span>
                      </div>
                      <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-widest text-xs h-10">
                        Candidatar-se à Equipe
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-muted-foreground bg-muted/5 p-3 rounded-xl border border-border/40">
                       <Lock className="h-4 w-4" />
                       <span className="text-xs font-bold uppercase tracking-tight">Evolua para desbloquear</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Quick Stats */}
          <section className="grid grid-cols-2 gap-3 md:gap-4">
             <div className="p-4 rounded-2xl bg-card border border-border/40 space-y-1 overflow-hidden group hover:border-primary/30 transition-colors">
               <div className="text-[10px] font-mono uppercase text-muted-foreground truncate flex items-center gap-1">
                 <Users className="h-3 w-3" /> Indicações
               </div>
               <div className="text-xl font-bold font-mono group-hover:text-primary transition-colors">{community.referrals}</div>
             </div>
             <div className="p-4 rounded-2xl bg-card border border-border/40 space-y-1 overflow-hidden group hover:border-primary/30 transition-colors">
               <div className="text-[10px] font-mono uppercase text-muted-foreground truncate flex items-center gap-1">
                 <Zap className="h-3 w-3" /> Conversões
               </div>
               <div className="text-xl font-bold font-mono group-hover:text-primary transition-colors">{community.conversions}</div>
             </div>
           </section>

           {/* Rewards / VIP Store Section */}
           <section className="space-y-4">
             <h2 className="text-xl font-display uppercase tracking-tight flex items-center gap-2">
               <Gift className="h-5 w-5 text-primary" /> Shadow Rewards
             </h2>
             <Card className="border-primary/10 bg-card/50 overflow-hidden">
               <CardContent className="p-6 space-y-4">
                 <p className="text-xs text-muted-foreground italic">
                   Benefícios exclusivos baseados no seu nível VIP e Shadow Points.
                 </p>
                 <div className="grid gap-3">
                   {vip.benefits.map((benefit: string, idx: number) => (
                     <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10 group hover:bg-primary/10 transition-colors">
                       <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                         <Star className="h-3 w-3" />
                       </div>
                       <span className="text-xs font-bold truncate">{benefit}</span>
                     </div>
                   ))}
                 </div>
                 <Button variant="outline" className="w-full mt-4 text-[10px] font-mono uppercase border-primary/20 hover:bg-primary/5">
                   Acessar Marketplace VIP
                 </Button>
               </CardContent>
             </Card>
            </section>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="missions" className="m-0">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {(data.missions || []).map((m: any) => (
              <Card key={m.id} className={cn(
                "border-primary/20 bg-card/50 backdrop-blur-sm relative overflow-hidden group transition-all",
                m.completed && "opacity-60 border-green-500/20"
              )}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-sm font-mono uppercase tracking-tight flex items-center gap-2">
                      {m.completed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Clock className="h-4 w-4 text-primary" />}
                      {m.title}
                    </CardTitle>
                    <Badge variant="outline" className="text-[9px] font-mono border-yellow-500/30 text-yellow-500">
                      +{m.reward_points} XP
                    </Badge>
                  </div>
                  <CardDescription className="text-[10px] font-mono leading-relaxed mt-1">
                    {m.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!m.completed && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[8px] font-mono uppercase text-muted-foreground">
                        <span>Progresso</span>
                        <span>{m.progress || 0}%</span>
                      </div>
                      <Progress value={m.progress || 0} className="h-1" />
                    </div>
                  )}
                  <Button 
                    variant={m.completed ? "outline" : "default"} 
                    className="w-full h-8 text-[10px] font-mono uppercase"
                    disabled={m.completed || (m.progress || 0) < 100}
                    onClick={() => {
                      toast.promise(claimRewardFn({ data: { missionId: m.id } }), {
                        loading: 'Resgatando XP...',
                        success: (res: any) => {
                          if (res.ok) {
                            queryClient.invalidateQueries({ queryKey: ['shadow-pass-data'] });
                            return res.message;
                          }
                          throw new Error(res.message);
                        },
                        error: (err) => err.message
                      });
                    }}
                  >
                    {m.completed ? "Recompensa Resgatada" : (m.progress || 0) < 100 ? "Em Andamento" : "Resgatar Recompensa"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Missões VIP */}
          <section className="mt-10 space-y-4">
            <h2 className="text-xl font-display uppercase tracking-tight flex items-center gap-2">
              <Diamond className="h-5 w-5 text-yellow-500" /> Missões VIP
              <Badge variant="outline" className="text-[9px] font-mono border-yellow-500/30 text-yellow-500">
                {vip.tier === 'none' ? 'BLOQUEADO' : vip.tier.toUpperCase()}
              </Badge>
            </h2>
            {(data.vipMissions || []).length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground">Nenhuma missão VIP ativa no momento.</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {(data.vipMissions || []).map((m: any) => (
                  <Card key={m.id} className={cn(
                    "border-yellow-500/20 bg-card/50 backdrop-blur-sm relative overflow-hidden transition-all",
                    m.completed && "opacity-60 border-green-500/20",
                    m.locked && "opacity-70"
                  )}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-sm font-mono uppercase tracking-tight flex items-center gap-2">
                          {m.locked ? <Lock className="h-4 w-4 text-yellow-500" />
                            : m.completed ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                            : <Diamond className="h-4 w-4 text-yellow-500" />}
                          {m.title}
                        </CardTitle>
                        <Badge variant="outline" className="text-[9px] font-mono border-yellow-500/30 text-yellow-500">
                          +{m.reward_points} XP
                        </Badge>
                      </div>
                      <CardDescription className="text-[10px] font-mono leading-relaxed mt-1">
                        {m.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-[9px] font-mono uppercase text-yellow-500/80">
                        Requer VIP {String(m.minVipTier || 'bronze').toUpperCase()}
                      </div>
                      {!m.completed && !m.locked && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-[8px] font-mono uppercase text-muted-foreground">
                            <span>Progresso</span>
                            <span>{m.progress || 0}%</span>
                          </div>
                          <Progress value={m.progress || 0} className="h-1 [&>div]:bg-yellow-500" />
                        </div>
                      )}
                      <Button
                        variant={m.completed ? "outline" : "default"}
                        className="w-full h-8 text-[10px] font-mono uppercase"
                        disabled={m.completed || m.locked || (m.progress || 0) < 100}
                        onClick={() => {
                          toast.promise(claimRewardFn({ data: { missionId: m.id } }), {
                            loading: 'Resgatando XP...',
                            success: (res: any) => {
                              if (res.ok) {
                                queryClient.invalidateQueries({ queryKey: ['shadow-pass-data'] });
                                return res.message;
                              }
                              throw new Error(res.message);
                            },
                            error: (err) => err.message,
                          });
                        }}
                      >
                        {m.locked ? "Exclusivo VIP"
                          : m.completed ? "Recompensa Resgatada"
                          : (m.progress || 0) < 100 ? "Em Andamento" : "Resgatar Recompensa"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="vip-benefits" className="m-0">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <Card className="border-yellow-500/20 bg-card/50 backdrop-blur-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                <Diamond className="h-32 w-32 text-yellow-500" />
              </div>
              <CardHeader>
                <CardTitle className="text-lg font-mono uppercase tracking-tight flex items-center gap-2">
                  <Shield className="h-5 w-5 text-yellow-500" /> Prioridade no Suporte
                </CardTitle>
                <CardDescription className="text-xs uppercase font-mono opacity-50">Exclusivo VIP</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Sua transmissão é priorizada no vácuo. Operadores VIP têm tempo de resposta garantido inferior a 15 minutos em dias úteis.
                </p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-yellow-500 uppercase tracking-tighter">
                    <CheckCircle2 className="h-4 w-4" /> Resposta em Tempo Real
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-tighter">
                    <Info className="h-4 w-4" /> Como chegar: VIP Tier via Compras ou Conquistas
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/50 backdrop-blur-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                <Zap className="h-32 w-32 text-primary" />
              </div>
              <CardHeader>
                <CardTitle className="text-lg font-mono uppercase tracking-tight flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" /> Play Protect Trial
                </CardTitle>
                <CardDescription className="text-xs uppercase font-mono opacity-50">Mensal · VIP+</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Resgate 1 dia gratuito de Bypass Play Protect uma vez por mês para testar novos vetores de ataque.
                </p>
                <TrialActivationButton />
              </CardContent>
            </Card>

            <Card className="border-emerald-500/20 bg-card/50 backdrop-blur-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                <Gift className="h-32 w-32 text-emerald-500" />
              </div>
              <CardHeader>
                <CardTitle className="text-lg font-mono uppercase tracking-tight flex items-center gap-2">
                  <Gift className="h-5 w-5 text-emerald-500" /> Marketplace Exclusivo
                </CardTitle>
                <CardDescription className="text-xs uppercase font-mono opacity-50">Itens Raros</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Acesso antecipado a exploits zero-day, bases de dados vazadas e ferramentas personalizadas de staff.
                </p>
                <div className="flex flex-col gap-2">
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 text-[9px] font-mono w-fit">
                    ACERVO ALPHA LIBERADO
                  </Badge>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Suba de nível VIP (VIP {"->"} Gold {"->"} Elite) através de conversões válidas e tempo de atividade no Shadow Dash.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TrialActivationButton() {
  const queryClient = useQueryClient();
  const generateTrialFn = useServerFn(generateTrial);
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'idle' | 'yaarsa' | 'login' | 'trial' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleActivate = async () => {
    setIsOpen(true);
    setStep('yaarsa');
    setErrorMsg(null);

    try {
      // Step 1: Enviando para Yaarsa
      await new Promise(r => setTimeout(r, 1500));
      setStep('login');

      // Step 2: Criando login e registrando trial
      const result = await generateTrialFn({ data: getDeviceSignature() });
      setStep('trial');

      // Step 3: Contagem de 24h
      await new Promise(r => setTimeout(r, 1000));
      setStep('success');
      
      queryClient.invalidateQueries({ queryKey: ['shadow-pass-data'] });
      toast.success("Teste Grátis ativado com sucesso!");
    } catch (err: any) {
      console.error("Trial Activation Error:", err);
      setStep('error');
      setErrorMsg(err.message || "Erro desconhecido na ativação.");
      toast.error("Falha na ativação: " + (err.message || "Erro desconhecido"));
    }
  };

  return (
    <>
      <Button 
        size="sm" 
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[10px] uppercase"
        onClick={handleActivate}
      >
        Resgatar 1 Dia Grátis
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => !['yaarsa', 'login', 'trial'].includes(step) && setIsOpen(open)}>
        <DialogContent className="sm:max-w-md bg-card border-primary/20 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-tight flex items-center gap-2">
              <Zap className={cn("h-5 w-5", step === 'error' ? "text-destructive" : "text-primary")} />
              Status da Ativação
            </DialogTitle>
            <DialogDescription className="font-mono text-[10px] uppercase opacity-60">
              Protocolo Shadow Trial v24.0
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-6">
            <div className="space-y-4">
              <StatusStep 
                label="Handshake com Servidor Yaarsa" 
                status={step === 'yaarsa' ? 'loading' : ['login', 'trial', 'success', 'error'].includes(step) && step !== 'error' ? 'success' : step === 'error' && errorMsg?.includes('Yaarsa') ? 'error' : 'pending'} 
              />
              <StatusStep 
                label="Provisionamento de Credenciais" 
                status={step === 'login' ? 'loading' : ['trial', 'success', 'error'].includes(step) && step !== 'error' ? 'success' : 'pending'} 
              />
              <StatusStep 
                label="Registro de Benefício 24h" 
                status={step === 'trial' ? 'loading' : step === 'success' ? 'success' : 'pending'} 
              />
            </div>

            {step === 'success' && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center animate-in zoom-in duration-300">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-emerald-500 uppercase font-mono">Acesso Liberado</p>
                <p className="text-[10px] text-muted-foreground mt-1">Sua licença de 24h está ativa no dashboard.</p>
                <Button className="mt-4 w-full h-8 text-[10px] font-mono uppercase" onClick={() => setIsOpen(false)}>
                  Entendido
                </Button>
              </div>
            )}

            {step === 'error' && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 space-y-3 animate-in shake duration-300">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase font-mono">Falha Crítica</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed bg-black/20 p-2 rounded border border-white/5 font-mono">
                  {errorMsg}
                </p>
                <Button variant="outline" className="w-full h-8 text-[10px] font-mono uppercase" onClick={() => setIsOpen(false)}>
                  Fechar e Reportar
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusStep({ label, status }: { label: string, status: 'pending' | 'loading' | 'success' | 'error' }) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-black/20 border border-white/5">
      <span className={cn(
        "text-[10px] font-mono uppercase tracking-tight",
        status === 'pending' ? "text-muted-foreground" : "text-foreground"
      )}>
        {label}
      </span>
      {status === 'loading' && <RefreshCw className="h-3 w-3 animate-spin text-primary" />}
      {status === 'success' && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
      {status === 'error' && <X className="h-3 w-3 text-destructive" />}
      {status === 'pending' && <Clock className="h-3 w-3 text-muted-foreground/30" />}
    </div>
  );
}

function CriteriaItem({ label, met }: { label: string, met: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn("text-xs font-mono uppercase tracking-tight truncate", met ? "text-foreground" : "text-muted-foreground")}>{label}</span>
      {met ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> : <div className="h-4 w-4 rounded-full border border-dashed border-muted-foreground/50 shrink-0" />}
    </div>
  );
}
