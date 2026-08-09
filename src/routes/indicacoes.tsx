import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Users, Copy, Check, TrendingUp, DollarSign, Clock, AlertCircle, Award, Star, ShieldCheck, Target, Zap, ChevronRight, Gift, Trophy } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { Link } from "@tanstack/react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { getMyReferralInfo, updateReferralPref } from "@/lib/referrals.functions";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { formatBrl } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/indicacoes")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [{ title: "Indicações — Shadow" }] }),
  component: ReferralsPage,
});


function ReferralsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [copied, setCopied] = useState(false);

  const getInfoFn = useServerFn(getMyReferralInfo);
  const updatePrefFn = useServerFn(updateReferralPref);

  useEffect(() => {
    getInfoFn().then(setData).catch(console.error).finally(() => setLoading(false));
  }, [getInfoFn]);

  const copyCode = () => {
    if (!data?.code) return;
    navigator.clipboard.writeText(data.code);
    setCopied(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrefChange = async (pref: "cashback" | "pix" | "free_month") => {
    setUpdating(true);
    try {
      await updatePrefFn({ data: { pref } });
      setData((prev: any) => ({ ...prev, pref }));
      toast.success("Preferência atualizada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <SiteHeader />
          <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                {t('ref.kicker')}
              </div>
              <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl uppercase italic">
                {t('ref.program')}
              </h1>
              <p className="mt-4 max-w-2xl text-muted-foreground">
                {t('ref.lead')}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-4 mb-8">
              <Card className="bg-card border-border backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{t('ref.stats_total')}</span>
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-3xl font-bold">{data?.stats?.total ?? 0}</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Indicações Válidas</span>
                    <Check className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-3xl font-bold">{data?.stats?.granted ?? 0}</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Shadow Pontos</span>
                    <Trophy className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-3xl font-bold">{data?.stats?.points ?? 0}</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Trust Score</span>
                    <ShieldCheck className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="text-3xl font-bold">{data?.stats?.trust ?? 100}</div>
                </CardContent>
              </Card>
            </div>

            <div className="mb-8 p-6 bg-card border rounded-xl">
               <div className="flex items-center justify-between mb-4">
                 <div>
                    <h3 className="font-display text-xl font-bold">{data?.level?.name || "Novato"}</h3>
                    <p className="text-sm text-muted-foreground">Próximo nível: {data?.nextLevel?.name || "Lendário"}</p>
                 </div>
                 <Badge variant="outline" className="px-3 py-1 font-mono">{data?.stats?.conversions ?? 0} Conversões</Badge>
               </div>
               <Progress value={Math.min(100, ((data?.stats?.conversions ?? 0) / (data?.nextLevel?.min_conversions || 1)) * 100)} className="h-2" />
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-card border">
                    <TabsTrigger value="overview">Geral</TabsTrigger>
                    <TabsTrigger value="rewards">Minhas Recompensas</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="space-y-6 mt-6">
                    <Card className="bg-card border-l-4 border-l-primary shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-sm font-mono uppercase tracking-widest">{t('ref.code_label')}</CardTitle>
                        <CardDescription>Compartilhe seu código para ganhar pontos e subir de nível.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center gap-4">
                            <div className="flex-1 bg-primary/5 border border-primary/20 rounded-lg p-4 font-mono text-2xl font-black tracking-tighter text-center">
                              {loading ? "..." : data?.code}
                            </div>
                            <Button onClick={copyCode} size="lg" className="h-full px-8">
                              {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                            </Button>
                          </div>
                          
                          {data?.code && (
                            <div className="rounded border bg-muted/30 p-3 flex flex-col gap-2">
                              <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-tighter">Seu link de indicação único:</span>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 text-[10px] truncate bg-muted p-2 rounded border text-primary">
                                  https://www.shadowdashstore.com/auth?ref={data.code}
                                </code>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 px-2"
                                  onClick={() => {
                                    navigator.clipboard.writeText(`https://www.shadowdashstore.com/auth?ref=${data.code}`);
                                    toast.success("Link copiado!");
                                  }}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-card border shadow-md">
                      <CardHeader>
                        <CardTitle className="text-sm font-mono uppercase tracking-widest">{t('ref.pref_title')}</CardTitle>
                        <CardDescription>Como você deseja receber suas recompensas de indicação.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {[
                            { id: "cashback", label: "Crédito Shadow", icon: DollarSign },
                            { id: "pix", label: "Saldo PIX", icon: TrendingUp },
                            { id: "free_month", label: "Mês Grátis", icon: Clock },
                          ].map((p) => (
                            <Button
                              key={p.id}
                              variant={data?.pref === p.id ? "default" : "outline"}
                              disabled={updating || loading}
                              onClick={() => handlePrefChange(p.id as any)}
                              className="h-auto py-4 flex flex-col gap-2"
                            >
                              <p.icon className="h-5 w-5" />
                              <span className="text-[10px] font-mono uppercase">{p.label}</span>
                            </Button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="rewards" className="space-y-6 mt-6">
                    <div className="grid gap-4">
                      {!data?.rewards?.length ? (
                        <Card className="bg-card border border-dashed p-12 text-center">
                          <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                          <p className="text-muted-foreground italic">Nenhuma recompensa registrada ainda.</p>
                        </Card>
                      ) : (
                        data.rewards.map((reward: any) => (
                          <Card key={reward.id} className="bg-card border overflow-hidden">
                            <div className="p-4 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                  {reward.reward_type === 'points' ? <Star className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
                                </div>
                                <div>
                                  <p className="font-bold text-sm uppercase font-mono">{reward.description || 'Recompensa de Indicação'}</p>
                                  <p className="text-[10px] text-muted-foreground">{new Date(reward.created_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge variant={reward.status === 'released' ? 'default' : 'outline'}>
                                  {reward.status === 'released' ? 'Liberado' : 'Pendente'}
                                </Badge>
                                <p className="mt-1 font-bold text-primary">{reward.amount} {reward.reward_type === 'points' ? 'PTS' : 'BRL'}</p>
                              </div>
                            </div>
                          </Card>
                        ))
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="space-y-6">
                <Card className="bg-card border shadow-md">
                  <CardHeader>
                    <CardTitle className="text-sm font-mono uppercase tracking-widest">{t('ref.list_title')}</CardTitle>
                    <CardDescription>Histórico de novos membros que entraram pelo seu link.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {loading ? (
                        <div className="text-center py-8 text-muted-foreground animate-pulse">Carregando indicações...</div>
                      ) : !data?.referrals?.length ? (
                        <div className="text-center py-12 border border-dashed rounded-xl">
                          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                          <p className="text-sm text-muted-foreground">{t('ref.no_referrals')}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {data.referrals.map((r: any) => (
                            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border text-[11px] font-mono uppercase">
                              <span className="font-bold truncate max-w-[100px]">{r.referred_label}</span>
                              <Badge variant="outline" className="text-[9px] h-5">
                                {r.status === 'converted' ? 'Convertido' : 'Inscrito'}
                              </Badge>
                              <span className="text-primary font-bold">{formatBrl(r.reward_amount || 0)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-primary/5 border border-primary/20 shadow-md">
                   <CardHeader>
                     <CardTitle className="text-xs font-mono uppercase flex items-center gap-2">
                       <Zap className="h-4 w-4 text-primary" /> Benefícios do Nível
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                      <p>• {data?.level?.reward_multiplier || 1}x Multiplicador de Pontos</p>
                      <p>• {data?.level?.cashback_percent || 0}% Cashback em Renovações</p>
                      <p>• Suporte Prioritário Nível {data?.level?.name === 'Novato' ? '1' : '2'}</p>
                   </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
