import { createFileRoute } from '@tanstack/react-router'
import { Clock, Copy, LifeBuoy, Sparkles, ShoppingBag, Activity, Server, Ticket, ShieldCheck, Download, KeyRound, PackageOpen, Inbox, ExternalLink, Eye, EyeOff, Video, RefreshCw, Users, Store, Gift, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReferralsWidget } from "@/components/ReferralsWidget";
import { HelpCenterWidget } from "@/components/HelpCenterWidget";
import { PromotionsWidget } from "@/components/PromotionsWidget";


import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/AppSidebar'
import { SecurityWelcomeDialog } from '@/components/SecurityWelcomeDialog'
import { TutorialHintDialog } from '@/components/TutorialHintDialog'
import { InAppNotifications } from '@/components/InAppNotifications'
import { AnnouncementsSection } from '@/components/AnnouncementsSection'
import { EmptyState } from '@/components/EmptyState'
import { SupportDiagnosticButton } from '@/components/SupportDiagnosticButton'
import { OnboardingChecklist } from '@/components/OnboardingChecklist'
import { TrialActivationCard } from '@/components/TrialActivationCard'
import { WelcomeProfileDialog } from '@/components/WelcomeProfileDialog'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { useI18n } from '@/lib/i18n'
import { listMyUpdates, getUpdateDownloadUrl } from '@/lib/updates.functions'
import { listMyLicenses, syncAllMyLicenses } from '@/lib/license.functions'
import { triggerDownload, friendlyDownloadError } from '@/lib/download'
const shadowMark = "/assets/shadow-logo-v10.png?v=v10-100";
import { downloadsForTier, tierFromPlanSlug, type VersionTier } from '@/lib/plans'
import { useServerNow } from '@/hooks/use-server-now'
import { licenseExpiryState } from '@/lib/expiry'
import { LicenseCountdown } from '@/components/LicenseCountdown'
import { ExpiryAlertBanner } from '@/components/ExpiryAlertBanner'
import { LicensePauseControls } from '@/components/LicensePauseControls'
import { LicenseAccessTools } from '@/components/LicenseAccessTools'
import { RedeemCodeCard } from '@/components/RedeemCodeCard'

import { planLabel } from '@/lib/license-display'
import { reconcileMyRecentOrders } from '@/lib/checkout.functions'
import { registerMyDevice } from '@/lib/device.functions'
import { getDeviceSignature } from '@/lib/device-signature'

export const Route = createFileRoute('/_authenticated/dashboard')({
  head: () => ({
    meta: [
      { title: 'Dashboard — Shadow' },
      { name: 'description', content: 'Painel do cliente Shadow para gerenciar licenças, acessos e suporte.' },
      { property: 'og:title', content: 'Dashboard — Shadow' },
      { property: 'og:description', content: 'Gerencie suas licenças, acessos e suporte Shadow.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: DashboardPage,
})

function DashboardPage() {
  const { trial: trialParam } = Route.useSearch() as any;
  const { t } = useI18n()

  // Antifraude passiva: registra a assinatura do aparelho assim que o cliente
  // entra no painel, muito antes de tentar resgatar qualquer benefício.
  const registerDevice = useServerFn(registerMyDevice)
  useEffect(() => {
    void registerDevice({ data: getDeviceSignature() }).catch(() => {})
  }, [registerDevice])

  const { resolved } = useTheme()
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [user, setUser] = useState<any>(undefined)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const serverNow = useServerNow()
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  // Auto-oculta credenciais reveladas após 30s (shoulder-surfing).
  useEffect(() => {
    const openIds = Object.entries(revealed).filter(([, v]) => v).map(([k]) => k)
    if (openIds.length === 0) return
    const t = setTimeout(() => {
      setRevealed((prev) => {
        const next = { ...prev }
        for (const id of openIds) next[id] = false
        return next
      })
    }, 30000)
    return () => clearTimeout(t)
  }, [revealed])

  const listUpdates = useServerFn(listMyUpdates)
  const getDownload = useServerFn(getUpdateDownloadUrl)
  const fetchMyLicenses = useServerFn(listMyLicenses)
  const reconcileOrders = useServerFn(reconcileMyRecentOrders)
  const syncLicensesFn = useServerFn(syncAllMyLicenses)
  const [syncing, setSyncing] = useState(false)



  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }: any) => {
      if (mounted) setUser(data.session?.user ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ?? null)
    })
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!user?.id
  })

  const {
    data: licenses,
    isPending: licensesLoading,
    error: licensesError,
    refetch: refetchLicenses,
  } = useQuery({
    queryKey: ['licenses', user?.id],
    queryFn: async () => {
      try {
        await reconcileOrders()
        const result = await fetchMyLicenses()
        return result ?? []
      } catch (err: any) {
        console.error("fetchMyLicenses failed, falling back to direct supabase read", err)
        
        // Se o erro for de tabela inexistente, o dashboard deve saber para mostrar o alerta
        const isTableMissing = err?.message?.includes("relation \"public.tutorials\" does not exist") || 
                              err?.message?.includes("public.tutorials' in the schema cache")
        
        const { data, error } = await supabase
          .from('licenses')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false })
          
        if (error) {
          // Se a tabela licenses também falhar (problema crítico de DB), propaga
          throw error
        }
        
        // Anexa info de erro de schema se detectado em fetchMyLicenses (que pode ler várias tabelas)
        if (isTableMissing) {
          (data as any)._schemaError = "public.tutorials"
        }
        
        return data ?? []
      }
    },
    enabled: !!user?.id,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * (attempt + 1), 2000),
    staleTime: 5000,
    gcTime: 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    placeholderData: (prev: any) => prev,
  })

  // Licenças ao vivo: troca de senha, renovação e resgate de código aparecem
  // na hora, sem precisar de F5.
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`licenses-live-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'licenses', filter: `user_id=eq.${user.id}` },
        () => { void refetchLicenses() },
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [user?.id, refetchLicenses])




  const {
    data: updates = [],
    isPending: updatesLoading,
    error: updatesError,
    refetch: refetchUpdates,
  } = useQuery({
    queryKey: ['my-updates', user?.id],
    queryFn: async () => (await listUpdates()) ?? [],
    enabled: !!user?.id,
    retry: 1,
  })


  const displayName = profile?.full_name || profile?.display_name || user?.email?.split('@')[0]
  const email = user?.email || ''

  const handleSync = async () => {
    // Exibição explicativa do que o botão faz
    toast.info("Iniciando Verificação Tática: O sistema irá forçar a sincronização de credenciais e datas com os nós globais, corrigindo bloqueios de login e expirações indevidas.", {
      duration: 5000,
    })

    setSyncing(true)
    try {
      const result = await syncLicensesFn()
      if (result.ok) {
        toast.success(`Integridade restaurada! ${result.synced} licença(s) foram sincronizadas com sucesso.`)
        refetchLicenses()
      }
    } catch (err) {
      toast.error("Falha na sincronização automática. Tente novamente ou contate o suporte.")
    } finally {
      setSyncing(false)
    }
  }
  
  const isLicenseActive = (license: any) => {
    const s = licenseExpiryState(license, serverNow)
    return s.active || s.paused
  }
  const activeLicense = licenses?.find((l: any) => licenseExpiryState(l, serverNow).active)
  const pausedLicense = licenses?.find((l: any) => licenseExpiryState(l, serverNow).paused)
  const currentLicense = activeLicense || pausedLicense
  const expiry = currentLicense ? licenseExpiryState(currentLicense, serverNow) : null
  
  // Sempre resolve um tier válido: version_tier -> plan_slug -> mensal (padrão),
  // garantindo que os downloads apareçam em todo recarregamento.
  const downloadsForLicense = (license: any) => {
    const tier = (license?.version_tier as VersionTier | null) ?? tierFromPlanSlug(license?.plan_slug)
    const files = downloadsForTier(tier)
    return files.length > 0 ? files : downloadsForTier('monthly_457')
  }
  const fallbackDownloads = currentLicense ? downloadsForLicense(currentLicense) : []
  const daysLeft = expiry ? expiry.daysLeft : null
  const lifetimeActive = !!expiry && expiry.active && expiry.countdownAt === null
  const terminalId = activeLicense?.server_ip || "None"
  const primary = activeLicense?.yaarsa_email || ''

  const statusColor = lifetimeActive ? "text-neon" : daysLeft === null ? "text-red-500" : daysLeft <= 3 ? "text-amber-500" : "text-neon"
  const statusRing = lifetimeActive ? "border-neon/30 bg-neon/5 shadow-neon/10" : daysLeft === null ? "border-red-500/30 bg-red-500/5 shadow-red-500/10" : daysLeft <= 3 ? "border-amber-500/30 bg-amber-500/5 shadow-amber-500/10" : "border-neon/30 bg-neon/5 shadow-neon/10"


  const copyPrimary = () => {
    if (primary) {
      navigator.clipboard.writeText(primary)
      toast.success(t("dash.copied" as any) || "Copiado!")
    }
  }

  const downloadUpdate = async (id: string) => {
    setDownloadingId(id)
    try {
      const file = await getDownload({ data: { id } })
      triggerDownload(file.url, file.filename)
    } catch (error) {
      toast.error(friendlyDownloadError(error))
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-x-hidden">
        <AppSidebar />
        <SidebarInset>
          <main className="flex-1 p-4 md:p-8 pt-6 relative client-enterprise">
            <div className="mx-auto max-w-7xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {trialParam === 'true' && !licensesLoading && !activeLicense && (licenses ?? []).every((l: any) => !l.is_trial) && (
                <div className="mb-4">
                  <TrialActivationCard onDone={() => void refetchLicenses()} />
                </div>
              )}

              <section className="enterprise-surface relative overflow-hidden p-5 md:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-5">
                    <div className="rounded-full border border-primary/20 bg-background/70 p-2 shadow-sm">
                      <img src={shadowMark} alt="Shadow" width={72} height={72} className="h-14 w-14 object-contain md:h-16 md:w-16 drop-shadow-[0_0_8px_rgba(201,168,76,0.6)] brightness-110 dark:brightness-125 light:mix-blend-multiply" />
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2 font-mono text-[9px] uppercase text-muted-foreground">
                        Nível de acesso <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary">Alpha-Ops</span>
                      </div>
                      <h1 className="truncate text-3xl font-bold text-foreground md:text-4xl">{displayName}</h1>
                      <div className="mt-2 flex items-center gap-4 font-mono text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> {new Date().toLocaleDateString('pt-BR')}</span>
                        <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <InAppNotifications />
                      </div>
                    </div>
                  </div>
                  <div className={`shrink-0 rounded-md border-2 px-5 py-3 text-right font-mono shadow-sm ${statusRing}`}>
                    <div className={`text-[10px] font-bold uppercase ${statusColor}`}>{lifetimeActive ? 'Acesso' : 'Dias de licença'}</div>
                    <div className={`mt-1 text-3xl font-black ${statusColor}`}>{lifetimeActive ? 'Vitalício' : daysLeft === null ? '00' : String(daysLeft).padStart(2, '0')}</div>

                    <div className="text-[10px] text-muted-foreground">{licenses?.length || 0} terminais ativos</div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-border/50 pt-3">
                  <Button size="sm" variant="outline" onClick={copyPrimary} disabled={!primary} className="font-mono text-[10px] uppercase"><Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar credenciais</Button>
                  <Button size="sm" variant="outline" onClick={() => setTutorialOpen(true)} className="font-mono text-[10px] uppercase"><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Tutorial</Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleSync} 
                    disabled={syncing}
                    className="font-mono text-[10px] uppercase rgb-button-animated border-none"
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin text-primary" : ""}`} /> 
                    {syncing ? "Sincronizando..." : "Corrigir Erros"}
                  </Button>
                  <Link to="/play-protect"><Button size="sm" variant="outline" className="font-mono text-[10px] uppercase text-amber-500 border-amber-500/30 hover:bg-amber-500/5"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Bypass Play Protect (APK)</Button></Link>
                  <Link to="/tutoriais"><Button size="sm" variant="outline" className="font-mono text-[10px] uppercase text-primary border-primary/30 hover:bg-primary/5"><Video className="mr-1.5 h-3.5 w-3.5" /> Hub de Vídeos</Button></Link>
                  <Link to="/suporte" search={{}}><Button size="sm" variant="outline" className="font-mono text-[10px] uppercase"><LifeBuoy className="mr-1.5 h-3.5 w-3.5" /> Suporte</Button></Link>
                  <Link to="/planos"><Button size="sm" className="font-mono text-[10px] uppercase"><ShoppingBag className="mr-1.5 h-3.5 w-3.5" /> Renovar agora</Button></Link>
                </div>
              </section>

              <ExpiryAlertBanner licenses={licenses} serverNow={serverNow} />

              {(licenses as any)?._schemaError === "public.tutorials" && (
                <Card className="border-red-500/30 bg-red-500/5 backdrop-blur-sm border-2 animate-pulse mb-4">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-red-500/20 p-2 rounded-full">
                        <ShieldCheck className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <h4 className="font-mono text-xs font-bold text-red-500 uppercase">Falha Crítica de Sincronização</h4>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          Tabela 'public.tutorials' não encontrada no cache do schema. Isso pode afetar o Hub de Vídeos.
                        </p>
                      </div>
                    </div>
                    <SupportDiagnosticButton 
                      error={(licenses as any)?._schemaError} 
                      context="Dashboard - Erro de Schema (Table Missing)"
                      label="Reportar Erro"
                      variant="outline"
                    />
                  </CardContent>
                </Card>
              )}


              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Crédito operacional', value: (profile as any)?.referral_balance ? `R$ ${(profile as any).referral_balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00', detail: 'Resgate disponível em PIX', icon: Activity, tone: 'text-primary' },
                  { label: 'Terminais ativos', value: String(licenses?.length || 0), detail: 'Nodes em sincronização', icon: Server, tone: 'text-cyan' },
                  { label: 'Tickets suporte', value: '0', detail: 'Sem alertas pendentes', icon: Ticket, tone: 'text-violet' },
                  { label: 'Integridade Ops', value: '100%', detail: 'Protocolo AES-256 ativo', icon: ShieldCheck, tone: 'text-amber-500' },
                ].map((stat) => (
                  <Card key={stat.label} className="enterprise-surface relative overflow-hidden border-border/60 shadow-none">
                    <CardContent className="p-5">
                      <stat.icon className={`absolute right-3 top-3 h-14 w-14 opacity-5 ${stat.tone}`} />
                      <div className="font-mono text-[9px] uppercase text-muted-foreground">{stat.label}</div>
                      <div className={`mt-2 font-mono text-3xl font-black ${stat.tone}`}>{stat.value}</div>
                      <div className="mt-2 font-mono text-[9px] uppercase text-muted-foreground">{stat.detail}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {!licensesLoading && !activeLicense && (licenses ?? []).every((l: any) => !l.is_trial) && trialParam !== 'true' && (
                <TrialActivationCard onDone={() => void refetchLicenses()} />
              )}



              <WelcomeProfileDialog />

              {licenses && licenses.length > 0 && (
                <OnboardingChecklist
                  hasActiveLicense={!!activeLicense}
                  onGoToLicense={() => {
                    const el = document.getElementById("status-operacional");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  onCopyCredentials={() => { copyPrimary(); return !!primary }}
                />
              )}

              <RedeemCodeCard licenses={licenses ?? []} onDone={() => void refetchLicenses()} />

              {activeLicense && (

                <section className="enterprise-surface overflow-hidden" aria-labelledby="usage-title">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-5 py-4">
                    <div>
                      <h2 id="usage-title" className="font-mono text-sm font-bold uppercase">Como usar sua licença</h2>
                      <p className="mt-1 text-xs text-muted-foreground">Passo a passo rápido + tempo restante</p>
                    </div>
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto]">
                    <ol className="space-y-3 text-sm">
                      {[
                        { t: 'Baixe o Shadow', d: 'Use os botões na seção "Downloads" abaixo para pegar o APK correto para o seu plano.' },
                        { t: 'Instale no Android', d: 'Desative o Play Protect antes de instalar (Play Store → Menu → Play Protect → Configurações).' },
                        { t: 'Faça login no app', d: 'Use o botão "Mostrar dados da licença" ao lado para revelar usuário, e-mail e senha, e cole no Shadow.' },
                        { t: 'Renovação', d: expiry?.renewalNote ?? '' },
                      ].map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-mono text-[10px] font-bold text-primary">{i + 1}</span>
                          <div>
                            <div className="font-semibold">{step.t}</div>
                            <div className="text-xs text-muted-foreground">{step.d}</div>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <div className="flex flex-col items-center gap-2">
                      {expiry?.countdownAt ? (
                        <LicenseCountdown
                          target={expiry.countdownAt}
                          serverNow={serverNow}
                          title="Sua licença vence em"
                          note={
                            expiry?.kind === 'trial'
                              ? 'Seu teste dura 24 horas cheias a partir da ativação. Quando o contador zerar, o login é encerrado automaticamente.'
                              : 'Contador dos dias que você comprou. Quando zerar, o login é encerrado — renove antes para não perder o acesso.'
                          }
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-primary/30 bg-primary/5 px-6 py-5 font-mono text-primary">
                          <div className="text-[10px] font-bold uppercase">Sua licença</div>
                          <div className="mt-1 text-3xl font-black uppercase">Vitalícia</div>
                          <div className="mt-2 max-w-[16rem] text-center text-[10px] normal-case leading-relaxed text-muted-foreground">
                            Não expira. Só a mensalidade do servidor precisa estar em dia.
                          </div>
                        </div>
                      )}
                      {expiry?.serverDueAt && (
                        <div className="max-w-[16rem] rounded-md border border-border/60 bg-background/50 px-3 py-2 text-center font-mono text-[10px] leading-relaxed text-muted-foreground">
                          Mensalidade do servidor (cobrança separada): vence em{' '}
                          <span className="text-foreground">
                            {new Date(expiry.serverDueAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      )}
                    </div>


                  </div>
                </section>
              )}

              <section className="enterprise-surface overflow-hidden shadow-[0_0_25px_rgba(var(--primary),0.05)] border-primary/10" aria-labelledby="licenses-title">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-5 py-4 bg-primary/5">
                  <div>
                    <h2 id="licenses-title" className="font-mono text-sm font-bold uppercase tracking-widest text-primary">Status Operacional</h2>
                    <p className="mt-1 text-[10px] uppercase tracking-tighter text-muted-foreground/60">Acessos vinculados à sua conta empresarial</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <SupportDiagnosticButton
                      licenses={licenses as any[]}
                      error={licensesError}
                      context="Painel do cliente — seção Status Operacional"
                      label="Reportar Incidente"
                    />
                    <KeyRound className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="grid gap-3 p-5 lg:grid-cols-2">
                  <div className="grid gap-2 sm:grid-cols-3 lg:col-span-2">
                    {[
                      { icon: Clock, t: 'Monitoramento em Tempo Real', d: 'O contador de validade é sincronizado com o servidor central — a expiração é absoluta.' },
                      { icon: Sparkles, t: 'Guia de Operação', d: 'Acesse a documentação técnica no topo para configurar bypass e Play Protect.' },
                      { icon: LifeBuoy, t: 'Suporte Tático', d: 'Dificuldades técnicas? Nossa equipe de suporte via chat está pronta para agir.' },
                    ].map((tip) => (
                      <div key={tip.t} className="flex gap-2.5 rounded-md border border-primary/20 bg-primary/5 p-4 transition-all hover:bg-primary/10">
                        <tip.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-primary">{tip.t}</div>
                          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">{tip.d}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {user === undefined || licensesLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando licenças…</p>
                  ) : licensesError ? (
                    <div className="flex flex-wrap items-center gap-3 text-sm text-destructive">
                      <span>Não foi possível carregar suas licenças.</span>
                      <Button size="sm" variant="outline" onClick={() => void refetchLicenses()}>Tentar novamente</Button>
                      <SupportDiagnosticButton
                        licenses={licenses as any[]}
                        error={licensesError}
                        context="Falha ao carregar licenças no painel"
                      />
                    </div>
                  ) : (licenses ?? []).length === 0 ? (
                    <div className="lg:col-span-2">
                      <EmptyState
                        icon={PackageOpen}
                        title="Nenhuma licença ativa"
                        description="Assine um plano para liberar seu acesso ao servidor e aos downloads exclusivos."
                        action={{ label: 'Ver planos', to: '/planos' }}
                        secondary={{ label: 'Abrir suporte', to: '/suporte' }}
                      />
                    </div>
                  ) : (licenses ?? []).map((license: any) => {
                    const active = isLicenseActive(license)
                    const licenseDownloads = active ? downloadsForLicense(license) : []
                    const state = licenseExpiryState(license, serverNow)
                    return (
                      <Card key={license.id} className="border-border/60 bg-background/40 shadow-none transition-all hover:border-primary/40 hover:bg-background/50">
                        <CardContent className="space-y-4 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold">{planLabel(license.plan_slug, license.is_trial)}</div>
                              <div className="text-xs text-muted-foreground">{license.yaarsa_email}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <span className={cn(
                                "rounded border px-2 py-1 font-mono text-[9px] uppercase font-bold tracking-widest",
                                state.paused ? 'border-amber-400/40 bg-amber-400/10 text-amber-500' : 
                                active ? 'border-primary/30 bg-primary/10 text-primary shadow-[0_0_8px_rgba(var(--primary),0.2)]' : 
                                'border-destructive/30 bg-destructive/10 text-destructive'
                              )}>
                                {state.paused ? 'Pausada' : active ? 'Ativa' : 'Inativa'}
                              </span>
                              {active && state.countdownAt && (
                                <LicenseCountdown compact target={state.countdownAt} serverNow={serverNow} />
                              )}
                            </div>
                          </div>
                          {(() => {
                            const fmt = (iso?: string | null) =>
                              iso
                                ? new Date(iso).toLocaleString('pt-BR', {
                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                    timeZone: 'America/Sao_Paulo',
                                  }) + ' (BRT)'
                                : '—'
                            // Fim real da licença: se pausada, vale a data guardada na pausa.
                            const endIso = state.paused
                              ? (license.expires_at_before_suspend ?? license.expires_at)
                              : license.expires_at
                            const startMs = license.created_at ? new Date(license.created_at).getTime() : null
                            const endMs = endIso ? new Date(endIso).getTime() : null
                            const totalDays =
                              startMs && endMs ? Math.max(0, Math.round((endMs - startMs) / 86400000)) : null
                            return (
                              <div className="grid gap-x-6 gap-y-3 rounded-md border border-border/50 bg-background/50 p-4 font-mono text-[11px] sm:grid-cols-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Comprada em</span>
                                  <span className="text-foreground font-medium">{fmt(license.created_at)}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">{state.paused ? 'Venceria em' : 'Vence em'}</span>
                                  <span className="text-foreground font-medium">{endIso ? fmt(endIso) : 'Vitalícia'}</span>
                                </div>
                                <div className="flex flex-col gap-0.5 border-t border-border/40 pt-2 sm:border-t-0 sm:pt-0">
                                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Período contratado</span>
                                  <span className="text-foreground font-medium">{totalDays !== null ? `${totalDays} dia${totalDays === 1 ? '' : 's'}` : 'Vitalícia'}</span>
                                </div>
                                <div className="flex flex-col gap-0.5 border-t border-border/40 pt-2 sm:border-t-0 sm:pt-0">
                                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Dias restantes</span>
                                  <span className={cn(
                                    "font-bold",
                                    state.paused ? "text-amber-500" : (state.daysLeft !== null && state.daysLeft <= 3) ? "text-destructive" : "text-primary"
                                  )}>
                                    {state.paused
                                      ? 'CONGELADOS'
                                      : state.daysLeft !== null
                                        ? `${Math.max(0, state.daysLeft)} DIAS`
                                        : '∞ ILIMITADO'}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5 border-t border-border/40 pt-2 sm:col-span-2">
                                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Servidor (IP do nó)</span>
                                  <span className="text-foreground font-bold tracking-tight">{license.server_ip || 'AGUARDANDO PROVISIONAMENTO'}</span>
                                </div>
                                {state.serverDueAt && (
                                  <div className="flex flex-col gap-0.5 border-t border-border/40 pt-2 sm:col-span-2">
                                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Mensalidade do servidor (Cobrança separada)</span>
                                    <span className="text-foreground font-medium">{fmt(state.serverDueAt)}</span>
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                          <p className="text-[11px] leading-relaxed text-muted-foreground">{state.renewalNote}</p>


                          <div className="border-t border-border/50 pt-3">
                            <LicensePauseControls license={license} state={state} onDone={() => void refetchLicenses()} />
                          </div>

                          <div className="border-t border-border/50 pt-3">
                            <LicenseAccessTools
                              licenseId={license.id}
                              paused={state.paused}
                              onDone={() => void refetchLicenses()}
                            />
                          </div>

                          <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 font-mono text-[9px] uppercase tracking-wider"
                              onClick={() => setRevealed((prev) => ({ ...prev, [license.id]: !prev[license.id] }))}
                            >
                              {revealed[license.id] ? <EyeOff className="mr-1.5 h-3.5 w-3.5 text-primary" /> : <Eye className="mr-1.5 h-3.5 w-3.5 text-primary" />}
                              {revealed[license.id] ? 'Ocultar Credenciais' : 'Revelar Acesso'}
                            </Button>
                          </div>
                          <div className="space-y-3">

                            {revealed[license.id] && (
                              <div className="animate-in fade-in slide-in-from-top-1 duration-200 space-y-2.5 rounded-md border border-primary/20 bg-primary/5 p-4 font-mono text-xs">
                                <div className="flex items-center gap-2 mb-2">
                                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Credenciais de Acesso</span>
                                </div>
                                {[
                                  { label: 'Usuário', value: license.yaarsa_username || license.yaarsa_email },
                                  { label: 'E-mail', value: license.yaarsa_email },
                                  { label: 'Senha', value: license.password ?? '••••••' },
                                  { label: 'Servidor', value: license.server_ip || '—' },
                                ].map((row) => (
                                  <div key={row.label} className="flex items-center justify-between gap-2 border-b border-primary/10 pb-1.5 last:border-0 last:pb-0">
                                    <span className="text-[9px] uppercase text-muted-foreground/70">{row.label}</span>
                                    <button
                                      type="button"
                                      className="group flex items-center gap-2 truncate font-medium text-foreground transition-colors hover:text-primary"
                                      onClick={() => { navigator.clipboard.writeText(String(row.value ?? '').trim()); toast.success('Copiado!') }}
                                    >
                                      <span className="truncate">{row.value}</span>
                                      <Copy className="h-3 w-3 shrink-0 opacity-40 transition-opacity group-hover:opacity-100" />
                                    </button>
                                  </div>
                                ))}
                                <p className="pt-2 text-[10px] italic leading-tight text-primary/60">
                                  * Use estes dados estritamente no painel Shadow. O compartilhamento de credenciais resultará em banimento imediato.
                                </p>
                              </div>
                            )}
                          </div>
                          {licenseDownloads.length > 0 && (
                            <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
                              {licenseDownloads.map((file: { url: string; label: string }) => (
                                <Button key={file.url} size="sm" variant="outline" asChild>
                                  <a href={file.url} target="_blank" rel="noreferrer">
                                    <Download className="mr-2 h-4 w-4" />{file.label}<ExternalLink className="ml-2 h-3 w-3" />
                                  </a>
                                </Button>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                  </div>
              </section>

              <section id="downloads" className="enterprise-surface scroll-mt-6 overflow-hidden" aria-labelledby="downloads-title">
                <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
                  <div><h2 id="downloads-title" className="font-mono text-sm font-bold uppercase">Downloads</h2><p className="mt-1 text-xs text-muted-foreground">Arquivos liberados para o seu plano</p></div>
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <div className="divide-y divide-border/50">
                  {updatesLoading ? (
                    <p className="p-5 text-sm text-muted-foreground">Carregando downloads…</p>
                  ) : updatesError ? (
                    <div className="flex flex-wrap items-center gap-3 p-5 text-sm text-destructive">
                      <span>Não foi possível carregar os downloads.</span>
                      <Button size="sm" variant="outline" onClick={() => void refetchUpdates()}>Tentar novamente</Button>
                    </div>
                  ) : updates.length === 0 && fallbackDownloads.length === 0 ? (
                    <div className="p-5">
                      <EmptyState
                        icon={Inbox}
                        title="Nenhum download disponível"
                        description="Os arquivos do seu plano aparecerão aqui assim que a liberação for confirmada."
                        action={{ label: 'Ver planos', to: '/planos' }}
                        secondary={{ label: 'Abrir suporte', to: '/suporte' }}
                      />
                    </div>
                  ) : updates.length > 0 ? updates.map((update: any) => (
                    <div key={update.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">

                      <div><div className="font-semibold">{update.title}</div><div className="font-mono text-xs text-muted-foreground">v{update.version} · {update.filename}</div></div>
                      <Button size="sm" variant="outline" disabled={downloadingId === update.id} onClick={() => void downloadUpdate(update.id)}><Download className="mr-2 h-4 w-4" />{downloadingId === update.id ? 'Preparando…' : 'Baixar'}</Button>
                    </div>
                  )) : fallbackDownloads.map((file) => (
                    <div key={file.url} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-semibold">{file.label}</div>
                        <div className="font-mono text-xs text-muted-foreground">Liberado pela sua licença{file.note ? ` · ${file.note}` : ''}</div>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <a href={file.url} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />Baixar <ExternalLink className="ml-2 h-3 w-3" /></a>
                      </Button>
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <PromotionsWidget />
                <ReferralsWidget />
                <div className="terminal-card p-4 relative overflow-hidden group">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-primary" />
                        <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">{t('nav.market')}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Módulos adicionais e ativos exclusivos.
                      </p>
                    </div>
                    <div className="h-8 w-8 rounded-full border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-black transition-colors shrink-0">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                  <Link to="/mercado" className="absolute inset-0 z-10" />
                </div>
                <div className="terminal-card p-4 relative overflow-hidden group">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4 text-primary" />
                        <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">{t('nav.gifts')}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Gerencie seus cartões presente.
                      </p>
                    </div>
                    <div className="h-8 w-8 rounded-full border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-black transition-colors shrink-0">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                  <Link to="/presentes" className="absolute inset-0 z-10" />
                </div>
              </div>

              <AnnouncementsSection />
            </div>
          </main>
        </SidebarInset>
      </div>
      
      <SecurityWelcomeDialog />
      <TutorialHintDialog open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </SidebarProvider>
  )
}
