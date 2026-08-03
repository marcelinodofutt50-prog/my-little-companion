import { createFileRoute } from '@tanstack/react-router'
import { Clock, Copy, LifeBuoy, Sparkles, ShoppingBag, Activity, Server, Ticket, ShieldCheck as ShieldIcon, Download, KeyRound, PackageOpen, Inbox, ExternalLink, Eye, EyeOff } from 'lucide-react'

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
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { useI18n } from '@/lib/i18n'
import { listMyUpdates, getUpdateDownloadUrl } from '@/lib/updates.functions'
import { listMyLicenses } from '@/lib/license.functions'
import { triggerDownload, friendlyDownloadError } from '@/lib/download'
import shadowMark from '@/assets/shadow-mask.png'
import { downloadsForTier, tierFromPlanSlug, type VersionTier } from '@/lib/plans'
import { useServerNow } from '@/hooks/use-server-now'
import { licenseExpiryState } from '@/lib/expiry'
import { LicenseCountdown } from '@/components/LicenseCountdown'
import { planLabel } from '@/lib/license-display'

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
  const { t } = useI18n()
  const { resolved } = useTheme()
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [user, setUser] = useState<any>(undefined)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const serverNow = useServerNow()
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const listUpdates = useServerFn(listMyUpdates)
  const getDownload = useServerFn(getUpdateDownloadUrl)
  const fetchMyLicenses = useServerFn(listMyLicenses)



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
        return (await fetchMyLicenses()) ?? []
      } catch {
        const { data, error } = await supabase
          .from('licenses')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false })
        if (error) throw error
        return data ?? []
      }
    },
    enabled: !!user?.id,
    retry: 2,
    retryDelay: (attempt) => Math.min(1500 * (attempt + 1), 4000),
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    placeholderData: (prev: any) => prev,
  })

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
  
  const isLicenseActive = (license: any) => licenseExpiryState(license, serverNow).active
  const activeLicense = licenses?.find(isLicenseActive)
  const expiry = activeLicense ? licenseExpiryState(activeLicense, serverNow) : null
  // Sempre resolve um tier válido: version_tier -> plan_slug -> mensal (padrão),
  // garantindo que os downloads apareçam em todo recarregamento.
  const downloadsForLicense = (license: any) => {
    const tier = (license?.version_tier as VersionTier | null) ?? tierFromPlanSlug(license?.plan_slug)
    const files = downloadsForTier(tier)
    return files.length > 0 ? files : downloadsForTier('monthly_457')
  }
  const fallbackDownloads = activeLicense ? downloadsForLicense(activeLicense) : []
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
          <main className="flex-1 p-4 md:p-8 pt-6 relative">
            <div className="mx-auto max-w-7xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <section className="enterprise-surface relative overflow-hidden p-5 md:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-5">
                    <div className="rounded-full border border-primary/20 bg-background/70 p-2 shadow-sm">
                      <img src={shadowMark} alt="Shadow" width={72} height={72} className="h-14 w-14 object-contain md:h-16 md:w-16" />
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
                    <div className={`text-[10px] font-bold uppercase ${statusColor}`}>{lifetimeActive ? 'Licença' : 'Dias de licença'}</div>
                    <div className={`mt-1 text-3xl font-black ${statusColor}`}>{lifetimeActive ? '∞' : daysLeft === null ? '00' : String(daysLeft).padStart(2, '0')}</div>

                    <div className="text-[10px] text-muted-foreground">{licenses?.length || 0} terminais ativos</div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-border/50 pt-3">
                  <Button size="sm" variant="outline" onClick={copyPrimary} disabled={!primary} className="font-mono text-[10px] uppercase"><Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar credenciais</Button>
                  <Button size="sm" variant="outline" onClick={() => setTutorialOpen(true)} className="font-mono text-[10px] uppercase"><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Tutorial</Button>
                  <Link to="/suporte" search={{}}><Button size="sm" variant="outline" className="font-mono text-[10px] uppercase"><LifeBuoy className="mr-1.5 h-3.5 w-3.5" /> Suporte</Button></Link>
                  <Link to="/planos"><Button size="sm" className="font-mono text-[10px] uppercase"><ShoppingBag className="mr-1.5 h-3.5 w-3.5" /> Renovar agora</Button></Link>
                </div>
              </section>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Crédito operacional', value: 'R$ 0,00', detail: 'Resgate disponível em PIX', icon: Activity, tone: 'text-primary' },
                  { label: 'Terminais ativos', value: String(licenses?.length || 0), detail: 'Nodes em sincronização', icon: Server, tone: 'text-cyan' },
                  { label: 'Tickets suporte', value: '0', detail: 'Sem alertas pendentes', icon: Ticket, tone: 'text-violet' },
                  { label: 'Integridade Ops', value: '100%', detail: 'Protocolo AES-256 ativo', icon: ShieldIcon, tone: 'text-amber-500' },
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

              {!licensesLoading && !activeLicense && (licenses ?? []).every((l: any) => !l.is_trial) && (
                <TrialActivationCard onDone={() => void refetchLicenses()} />
              )}

              <OnboardingChecklist
                hasActiveLicense={!!activeLicense}
                onGoToLicense={() => {}}
                onCopyCredentials={() => { copyPrimary(); return !!primary }}
              />

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

              <section className="enterprise-surface overflow-hidden" aria-labelledby="licenses-title">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-5 py-4">
                  <div>
                    <h2 id="licenses-title" className="font-mono text-sm font-bold uppercase">Minhas licenças</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Acessos vinculados à sua conta</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <SupportDiagnosticButton
                      licenses={licenses as any[]}
                      error={licensesError}
                      context="Painel do cliente — seção Minhas licenças"
                      label="Reportar problema"
                    />
                    <KeyRound className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="grid gap-3 p-5 lg:grid-cols-2">
                  <div className="grid gap-2 sm:grid-cols-3 lg:col-span-2">
                    {[
                      { icon: Clock, t: 'O contador manda', d: 'Quando o tempo zerar, o login é encerrado automaticamente — mesmo que o app mostre outra data.' },
                      { icon: Sparkles, t: 'Como usar seu login', d: 'Abra o Tutorial no topo do painel: instalação, Play Protect e primeiro acesso.' },
                      { icon: LifeBuoy, t: 'Ficou com dúvida?', d: 'Fale com o suporte pelo chat — a gente resolve login, senha e renovação.' },
                    ].map((tip) => (
                      <div key={tip.t} className="flex gap-2.5 rounded-md border border-border/50 bg-background/50 p-3">
                        <tip.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div>
                          <div className="text-xs font-semibold">{tip.t}</div>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{tip.d}</p>
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
                      <Card key={license.id} className="border-border/60 bg-background/40 shadow-none">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold">{planLabel(license.plan_slug, license.is_trial)}</div>
                              <div className="text-xs text-muted-foreground">{license.yaarsa_email}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <span className={`rounded border px-2 py-1 font-mono text-[9px] uppercase ${active ? 'border-primary/30 bg-primary/10 text-primary' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>{active ? 'Ativa' : 'Inativa'}</span>
                              {active && state.countdownAt && (
                                <LicenseCountdown compact target={state.countdownAt} serverNow={serverNow} />
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 font-mono text-xs text-muted-foreground">
                            <span>Servidor: {license.server_ip || '—'}</span>
                            <span>Expira: {license.expires_at ? new Date(license.expires_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Vitalícia'}</span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-muted-foreground">{state.renewalNote}</p>

                          <div className="space-y-2 border-t border-border/50 pt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="font-mono text-[10px] uppercase"
                              onClick={() => setRevealed((prev) => ({ ...prev, [license.id]: !prev[license.id] }))}
                            >
                              {revealed[license.id] ? <EyeOff className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                              {revealed[license.id] ? 'Ocultar dados' : 'Mostrar dados da licença'}
                            </Button>
                            {revealed[license.id] && (
                              <div className="space-y-1.5 rounded-md border border-border/60 bg-background/60 p-3 font-mono text-xs">
                                {[
                                  { label: 'Usuário', value: license.yaarsa_username || license.yaarsa_email },
                                  { label: 'E-mail', value: license.yaarsa_email },
                                  { label: 'Senha', value: license.password ?? '••••••' },
                                  { label: 'Servidor', value: license.server_ip || '—' },
                                ].map((row) => (
                                  <div key={row.label} className="flex items-center justify-between gap-2">
                                    <span className="text-muted-foreground">{row.label}</span>
                                    <button
                                      type="button"
                                      className="flex items-center gap-1.5 truncate text-foreground hover:text-primary"
                                      onClick={() => { navigator.clipboard.writeText(String(row.value ?? '')); toast.success('Copiado!') }}
                                    >
                                      <span className="truncate">{row.value}</span>
                                      <Copy className="h-3 w-3 shrink-0" />
                                    </button>
                                  </div>
                                ))}
                                <p className="pt-1 text-[10px] normal-case text-muted-foreground">
                                  Use estes dados para entrar no painel Shadow. Nunca compartilhe sua senha.
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
