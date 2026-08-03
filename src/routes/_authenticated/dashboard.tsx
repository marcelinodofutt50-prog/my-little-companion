import { createFileRoute } from '@tanstack/react-router'
import { Clock, Copy, LifeBuoy, Sparkles, ShoppingBag, Activity, Server, Ticket, ShieldCheck as ShieldIcon } from 'lucide-react'

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
import { AnnouncementsSection } from '@/components/AnnouncementsSection'
import { OnboardingChecklist } from '@/components/OnboardingChecklist'
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
  
  const activeLicense = licenses?.find((l: any) => !l.revoked && (!l.expires_at || new Date(l.expires_at) > new Date()))
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
                    <div className={`text-[10px] font-bold uppercase ${statusColor}`}>Dias de licença</div>
                    <div className={`mt-1 text-3xl font-black ${statusColor}`}>{daysLeft === null ? '00' : String(daysLeft).padStart(2, '0')}</div>
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

              <OnboardingChecklist
                hasActiveLicense={!!activeLicense}
                onGoToLicense={() => {}}
                onCopyCredentials={() => { copyPrimary(); return !!primary }}
              />

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
