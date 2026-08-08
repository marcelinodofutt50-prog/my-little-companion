import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Users, Copy, Check, TrendingUp, DollarSign, Clock, AlertCircle } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyReferralInfo, updateReferralPref } from "@/lib/referrals.functions";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { formatBrl } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/indicacoes")({
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
      <div className="flex min-h-screen w-full bg-black">
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

            <div className="grid gap-6 md:grid-cols-3 mb-8">
              <Card className="bg-black/40 border-primary/10 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{t('ref.stats_total')}</span>
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-3xl font-bold">{data?.stats?.total ?? 0}</div>
                </CardContent>
              </Card>
              <Card className="bg-black/40 border-primary/10 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{t('ref.stats_granted')}</span>
                    <Check className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-3xl font-bold">{data?.stats?.granted ?? 0}</div>
                </CardContent>
              </Card>
              <Card className="bg-black/40 border-primary/10 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{t('ref.stats_cashback')}</span>
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-3xl font-bold">{formatBrl(data?.stats?.cashback ?? 0)}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-6">
                <Card className="bg-black/40 border-primary/20 backdrop-blur-xl border-l-4 border-l-primary">
                  <CardHeader>
                    <CardTitle className="text-sm font-mono uppercase tracking-widest">{t('ref.code_label')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 bg-primary/5 border border-primary/20 rounded-lg p-4 font-mono text-2xl font-black tracking-tighter text-center">
                        {loading ? "..." : data?.code}
                      </div>
                      <Button onClick={copyCode} size="lg" className="h-full px-8">
                        {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('ref.share_tip')}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-black/40 border-primary/10 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-sm font-mono uppercase tracking-widest">{t('ref.pref_title')}</CardTitle>
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
              </div>

              <Card className="bg-black/40 border-primary/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-mono uppercase tracking-widest">{t('ref.list_title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {loading ? (
                      <div className="text-center py-8 text-muted-foreground animate-pulse">Carregando indicações...</div>
                    ) : !data?.referrals?.length ? (
                      <div className="text-center py-12 border border-dashed border-primary/10 rounded-xl">
                        <Users className="h-12 w-12 text-primary/10 mx-auto mb-4" />
                        <p className="text-sm text-muted-foreground">{t('ref.no_referrals')}</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] font-mono uppercase">
                          <thead>
                            <tr className="border-b border-primary/10">
                              <th className="text-left py-3 font-bold text-primary/60">{t('ref.table_who')}</th>
                              <th className="text-center py-3 font-bold text-primary/60">{t('ref.table_status')}</th>
                              <th className="text-right py-3 font-bold text-primary/60">{t('ref.table_amount')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.referrals.map((r: any) => (
                              <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                <td className="py-3 text-foreground font-medium">{r.referred_label}</td>
                                <td className="py-3 text-center">
                                  <span className={`px-2 py-0.5 rounded ${r.reward_status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                    {r.reward_status}
                                  </span>
                                </td>
                                <td className="py-3 text-right font-bold text-primary">{formatBrl(r.reward_amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
