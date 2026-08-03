import { createFileRoute } from '@tanstack/react-router'
import { BellRing, Clock, Copy, LifeBuoy, Sparkles, ShoppingBag, ArrowUpRight, Activity, LockIcon } from 'lucide-react'

import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/AppSidebar'
import { SecurityWelcomeDialog } from '@/components/SecurityWelcomeDialog'
import { TutorialHintDialog } from '@/components/TutorialHintDialog'
import { InAppNotifications } from '@/components/InAppNotifications'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { useI18n } from '@/lib/i18n'

const shadowMark = "https://yvvjaoqzhjqnchhwhwvy.supabase.co/storage/v1/object/public/assets/shadow_mark.png"

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { t } = useI18n()
  const { resolved } = useTheme()
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: any) => setUser(data.user))
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

  const { data: licenses } = useQuery({
    queryKey: ['licenses', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .eq('user_id', user?.id)
      if (error) throw error
      return data
    },
    enabled: !!user?.id
  })

  const displayName = profile?.full_name || profile?.display_name || user?.email?.split('@')[0]
  const email = user?.email || ''
  
  const activeLicense = licenses?.find(l => !l.revoked && (!l.expires_at || new Date(l.expires_at) > new Date()))
  const daysLeft = activeLicense?.expires_at ? Math.ceil((new Date(activeLicense.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : (activeLicense ? 99 : null)
  const terminalId = activeLicense?.server_ip || "None"
  const primary = activeLicense?.yaarsa_email || ''

  const statusColor = daysLeft === null ? "text-red-500" : daysLeft <= 3 ? "text-amber-500" : "text-neon"
  const statusRing = daysLeft === null ? "border-red-500/30 bg-red-500/5 shadow-red-500/10" : daysLeft <= 3 ? "border-amber-500/30 bg-amber-500/5 shadow-amber-500/10" : "border-neon/30 bg-neon/5 shadow-neon/10"

  const copyPrimary = () => {
    if (primary) {
      navigator.clipboard.writeText(primary)
      toast.success(t("dash.copied" as any) || "Copiado!")
    }
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-x-hidden">
        <AppSidebar />
        <SidebarInset>
          <main className="flex-1 p-4 md:p-8 pt-6 relative">
            <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              
              {/* Tactical Header / Hero */}
              <section className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/30 p-6 backdrop-blur-md md:p-10">
                {/* Atmospheric Glows */}
                <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-[100px] animate-pulse" />
                <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-cyan/10 blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
                
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between relative z-10">
                  <div className="flex items-center gap-5">
                    <div className="relative shrink-0">
                      <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-primary/30 blur-2xl animate-pulse" />
                      <div className="rounded-full border-2 border-primary/20 p-1 bg-background/50 backdrop-blur-sm shadow-2xl">
                        <img src={shadowMark} alt="Shadow" width={80} height={80} className="h-16 w-16 object-contain drop-shadow-[0_0_15px_oklch(0.78_0.13_82/0.5)] md:h-20 md:w-20" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary border border-primary/20 shadow-[0_0_10px_oklch(0.78_0.13_82/0.1)]">
                          {t("dash.access_level" as any) || "Nível de Acesso"}: Alpha-Ops
                        </span>
                      </div>
                      <h1 className="truncate font-display text-3xl font-bold tracking-tight sm:text-4xl text-foreground drop-shadow-sm">
                        {displayName}
                      </h1>
                      <div className="mt-2 flex flex-wrap items-center gap-4 font-mono text-[10px] text-muted-foreground/80">
                        <span className="flex items-center gap-2 bg-background/40 px-2 py-1 rounded border border-border/40">
                          <span className="h-1.5 w-1.5 rounded-full bg-neon animate-pulse shadow-[0_0_5px_var(--neon)]" /> 
                          SYSTEM ONLINE
                        </span>
                        <span className="flex items-center gap-2 bg-background/40 px-2 py-1 rounded border border-border/40">
                          <Clock className="h-3 w-3 text-primary" /> 
                          {new Date().toLocaleTimeString('pt-BR', { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        
                        {/* Real-time Notifications Bell */}
                        <InAppNotifications />

                      </div>
                    </div>
                  </div>

                  <div className={`shrink-0 rounded-lg border-2 px-4 py-3 text-right font-mono shadow-lg transition-all ${statusRing}`}>
                    <div className={`text-[10px] font-bold uppercase tracking-[0.25em] ${statusColor}`}>
                      {daysLeft === null ? (t("dash.offline" as any) || "OFFLINE") : daysLeft === 0 ? (t("dash.expires_today" as any) || "EXPIRA HOJE") : (t("dash.license_days" as any) || "DIAS RESTANTES")}
                    </div>
                    <div className={`text-2xl font-black leading-none mt-1 ${statusColor}`}>
                      {daysLeft === null ? "00" : String(daysLeft).padStart(2, '0')}
                    </div>
                    <div className="mt-1 text-[10px] font-medium text-muted-foreground/80">
                      {licenses?.length || 0} {t("dash.active_terminals" as any) || "Terminais"}
                    </div>
                  </div>
                </div>

                {/* Quick action bar */}
                <div className="mt-6 flex flex-wrap gap-2 border-t border-border/40 pt-4 relative z-10">
                  <Button size="sm" variant="outline" onClick={copyPrimary} disabled={!primary} className="font-mono text-[11px] uppercase tracking-wider">
                    <Copy className="mr-1.5 h-3 w-3" /> Copiar credenciais
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setTutorialOpen(true)} className="font-mono text-[11px] uppercase tracking-wider">
                    <Sparkles className="mr-1.5 h-3 w-3 text-neon" /> Tutorial
                  </Button>
                  <Link to="/suporte" search={{}}>
                    <Button size="sm" variant="outline" className="font-mono text-[11px] uppercase tracking-wider">
                      <LifeBuoy className="mr-1.5 h-3 w-3" /> Suporte
                    </Button>
                  </Link>
                  <Link to="/planos">
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[11px] uppercase tracking-wider shadow-lg shadow-primary/20">
                      <ShoppingBag className="mr-1.5 h-3 w-3" /> {t("dash.renew" as any) || "Renovar"}
                    </Button>
                  </Link>
                </div>
              </section>

              {/* Stats Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Crédito Operacional", value: "R$ 0,00", icon: Activity },
                  { label: "Infra Status", value: "Optimal", icon: ArrowUpRight },
                  { label: "Integridade Ops", value: "99.9%", icon: Activity },
                  { label: "Suporte", value: "Online", icon: LifeBuoy },
                ].map((stat, i) => (
                  <Card key={i} className="border-border/40 bg-card/30 backdrop-blur-md transition-all hover:bg-card/50">
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className="rounded-lg bg-primary/10 p-2 border border-primary/20">
                        <stat.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{stat.label}</div>
                        <div className="text-lg font-bold tracking-tight">{stat.value}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Credentials Section */}
              <Card className="border-border/40 bg-card/30 backdrop-blur-md overflow-hidden">
                <div className="border-b border-border/40 bg-muted/20 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LockIcon className="h-4 w-4 text-primary" />
                    <span className="font-mono text-xs font-bold uppercase tracking-[0.2em]">Diretório de Acesso</span>
                  </div>
                  <div className="h-1.5 w-1.5 rounded-full bg-neon animate-pulse" />
                </div>
                <CardContent className="p-6">
                  <div className="grid gap-6 md:grid-cols-3">
                    {[
                      { label: "Primary Access", value: primary || "N/A" },
                      { label: "Secondary Vector", value: "Locked" },
                      { label: "Terminal Node", value: terminalId },
                    ].map((item, i) => (
                      <div key={i} className="space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{item.label}</div>
                        <div className="flex items-center justify-between rounded border border-border/40 bg-background/40 px-3 py-2 font-mono text-sm group transition-all hover:border-primary/40">
                          <span className="truncate">{item.value}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => {
                            navigator.clipboard.writeText(item.value);
                            toast.success("Copiado!");
                          }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </div>
          </main>
        </SidebarInset>
      </div>
      
      <SecurityWelcomeDialog />
      <TutorialHintDialog open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </SidebarProvider>
  )
}
