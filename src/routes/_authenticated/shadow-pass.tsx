import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { 
  User, Trophy, Users, Award, Gift, Diamond, Shield, Bell, 
  ChevronRight, CheckCircle2, Star, Zap, Clock, TrendingUp,
  Lock, ExternalLink, Info, BadgeCheck, Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getShadowPassData } from '@/lib/shadow-core.functions';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
  const { data } = useSuspenseQuery({
    queryKey: ['shadow-pass-data'],
    queryFn: () => getShadowPassData(),
  });

  const { identity, loyalty, community, vip, reputation, staff } = data as any;

  return (
    <div className="container mx-auto px-4 py-6 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500 max-w-6xl pb-24 md:pb-8">
      {/* Header Profile */}
      <header className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-primary/20 bg-card p-5 md:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <Shield className="h-64 w-64 rotate-12" />
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 relative z-10">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
            <Avatar className="h-20 w-20 md:h-32 md:w-32 border-4 border-primary shadow-2xl relative">
              <AvatarImage src={identity.avatar} />
              <AvatarFallback className="bg-muted text-2xl font-bold">
                {identity.nickname?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {vip.tier !== 'none' && (
              <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground p-2 rounded-full shadow-lg">
                <Diamond className="h-5 w-5" />
              </div>
            )}
          </div>
          
          <div className="text-center md:text-left space-y-2 w-full">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-3">
              <h1 className="text-2xl md:text-5xl font-bold tracking-tight font-display uppercase italic break-all">
                {identity.nickname}
              </h1>
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest border-primary/50 text-primary">
                ID: {identity.id.substring(0, 8)}
              </Badge>
              {staff.isEligible && (
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] uppercase tracking-widest">
                  Equipe Elegível
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">
              // Membro desde {new Date(identity.joinedAt).toLocaleDateString()}
            </p>
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

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
        {/* Left Column: Progress & Community */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          {/* Progress Overview */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-display uppercase tracking-tight flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" /> Evolução de Carreira
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Loyalty Progress */}
              <Card className="border-primary/10 bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono uppercase tracking-widest text-muted-foreground flex justify-between">
                    Loyalty Level <span>{Math.round(loyalty.progress)}%</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={loyalty.progress} className="h-2" />
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold">{loyalty.tier}</span>
                    <span className="text-muted-foreground">Próximo: {loyalty.nextTier || 'Max'}</span>
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

              {/* VIP Progress */}
              <Card className="border-yellow-500/10 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono uppercase tracking-widest text-muted-foreground flex justify-between">
                    Shadow VIP <span>{vip.tier === 'elite' ? '100%' : '78%'}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={vip.tier === 'elite' ? 100 : 78} className="h-2 bg-yellow-500/10 [&>div]:bg-yellow-500" />
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-yellow-500 capitalize">{vip.tier}</span>
                    <span className="text-muted-foreground">Próximo: {vip.next?.tier || 'Max'}</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {vip.benefits.map((b: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[9px] font-mono px-1 py-0">{b}</Badge>
                    ))}
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
                            <Badge className="bg-primary/20 text-primary border-primary/30">{achievedGoals}/{totalGoals} Concluídas</Badge>
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
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "h-8 w-8 rounded-full flex items-center justify-center",
                                  goal.achieved_at ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"
                                )}>
                                  {goal.achieved_at ? <CheckCircle2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                </div>
                                <div>
                                  <div className="text-sm font-bold">{goal.target_members} Membros</div>
                                  <div className="text-[10px] text-muted-foreground font-mono">{goal.reward_description}</div>
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
          </section>
        </div>

        {/* Right Column: Reputation, Staff & Rewards */}
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
                <Badge variant="outline" className="text-[9px] font-mono uppercase text-primary border-primary/30">CONTA CONFIÁVEL</Badge>
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
             <div className="p-4 rounded-2xl bg-card border border-border/40 space-y-1">
               <div className="text-[10px] font-mono uppercase text-muted-foreground">Indicações</div>
               <div className="text-xl font-bold font-mono">{community.referrals}</div>
             </div>
             <div className="p-4 rounded-2xl bg-card border border-border/40 space-y-1">
               <div className="text-[10px] font-mono uppercase text-muted-foreground">Conversões</div>
               <div className="text-xl font-bold font-mono">{community.conversions}</div>
             </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function CriteriaItem({ label, met }: { label: string, met: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-xs font-mono uppercase tracking-tight", met ? "text-foreground" : "text-muted-foreground")}>{label}</span>
      {met ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <div className="h-4 w-4 rounded-full border border-dashed border-muted-foreground/50" />}
    </div>
  );
}
