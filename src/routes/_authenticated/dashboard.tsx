import { createFileRoute } from '@tanstack/react-router'
import { BellRing, Clock, Copy, LifeBuoy, Sparkles, ShoppingBag, ArrowUpRight, Activity, LockIcon, Building2, Globe, ShieldCheck as ShieldIcon, ChevronRight } from 'lucide-react'

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
            <div className="mx-auto max-w-7xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              
              {/* Executive Bulletin Banner */}
              <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 backdrop-blur-sm">
                <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
                  <div className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-widest text-primary shrink-0">
                    <Building2 className="h-3 w-3" /> Mirror Enterprise Bulletin
                  </div>
                  <div className="h-4 w-px bg-primary/20 shrink-0" />
                  <div className="flex animate-marquee gap-8 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    <span>• Global Nodes Operating at 99.9% Efficiency</span>
                    <span>• Shadow 4.6.2 Migration Wave in Progress</span>
                    <span>• Multi-Regional Redundancy Active</span>
                    <span>• Encryption Standards Verified (AES-256)</span>
                  </div>
                </div>
              </div>

              {/* Enterprise Header / Hero */}
              <section className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/30 p-6 backdrop-blur-md md:p-8">
                {/* Refined Enterprise Glows */}
                <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-[120px]" />
                <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/5 blur-[120px]" />
                
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between relative z-10">
                  <div className="flex items-center gap-6">
                    <div className="relative shrink-0">
                      <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-primary/20 blur-3xl animate-pulse" />
                      <div className="rounded-2xl border border-primary/30 p-3 bg-background/60 backdrop-blur-md shadow-2xl relative">
                        <img src={shadowMark} alt="Shadow" width={70} height={70} className="h-14 w-14 object-contain brightness-110 drop-shadow-[0_0_20px_var(--color-primary)]" />
                        <div className="absolute -bottom-1 -right-1 rounded-full bg-neon p-1 shadow-[0_0_10px_var(--neon)]">
                          <ShieldIcon className="h-3 w-3 text-black" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="rounded bg-white/5 border border-white/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white/70">
                          Corporate ID: {user?.id?.slice(0, 8).toUpperCase()}
                        </span>
                        <div className="h-3 w-px bg-white/10" />
                        <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary">
                          <Globe className="h-3 w-3" /> Tier 1 Enterprise
                        </span>
                      </div>
                      
                      <h1 className="truncate font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                        {displayName}
                      </h1>
                      
                      <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[10px]">
                        <span className="flex items-center gap-2 rounded-full bg-neon/10 px-3 py-1 text-neon border border-neon/20 shadow-[0_0_15px_rgba(var(--neon),0.1)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-neon animate-pulse" /> 
                          Network Status: Verified
                        </span>
                        <span className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-muted-foreground border border-white/10">
                          <Clock className="h-3.5 w-3.5 text-primary" /> 
                          {new Date().toLocaleTimeString('pt-BR', { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                        <InAppNotifications />
                      </div>
                    </div>
                  </div>

                  <div className={`relative shrink-0 rounded-xl border bg-background/40 p-5 text-right font-mono transition-all overflow-hidden ${statusRing}`}>
                    <div className="absolute top-0 right-0 p-1 opacity-10">
                      <Building2 className="h-10 w-10" />
                    </div>
                    <div className={`text-[9px] font-black uppercase tracking-[0.3em] mb-1 ${statusColor}`}>
                      {daysLeft === null ? "Contract Expired" : "Service Remaining"}
                    </div>
                    <div className={`text-4xl font-black leading-none flex items-baseline justify-end gap-1 ${statusColor}`}>
                      {daysLeft === null ? "00" : String(daysLeft).padStart(2, '0')}
                      <span className="text-[10px] uppercase font-bold text-muted-foreground/60">Days</span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80 flex items-center justify-end gap-2">
                      <Activity className="h-3 w-3 text-primary" />
                      {licenses?.length || 0} Assets Provisioned
                    </div>
                  </div>
                </div>

                {/* Corporate Navigation bar */}
                <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-white/5 pt-5 relative z-10">
                  <Button variant="outline" onClick={copyPrimary} disabled={!primary} className="rounded-lg h-9 font-mono text-[10px] uppercase tracking-widest bg-white/5 border-white/10 hover:bg-white/10">
                    <Copy className="mr-2 h-3.5 w-3.5 text-primary" /> Access Credentials
                  </Button>
                  <Link to="/planos" className="ml-auto">
                    <Button className="rounded-lg h-9 bg-primary px-6 font-mono text-[10px] uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
                      <ShoppingBag className="mr-2 h-3.5 w-3.5" /> Extend Agreement
                    </Button>
                  </Link>
                  <Link to="/suporte">
                    <Button variant="ghost" className="h-9 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-white">
                      Professional Support <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </section>

              <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Stats Column */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      { label: "SLA Commitment", value: "99.98%", icon: ShieldIcon, color: "text-primary" },
                      { label: "Asset Compliance", value: "Compliant", icon: ShieldIcon, color: "text-neon" },
                      { label: "Network Latency", value: "14ms", icon: Globe, color: "text-cyan" },
                    ].map((stat, i) => (
                      <Card key={i} className="border-border/40 bg-card/30 backdrop-blur-md overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <CardContent className="flex flex-col gap-3 p-5">
                          <div className={`rounded-lg bg-white/5 p-2 w-fit border border-white/10 ${stat.color}`}>
                            <stat.icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">{stat.label}</div>
                            <div className="text-xl font-extrabold tracking-tight mt-0.5">{stat.value}</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Infrastructure Status */}
                  <Card className="border-border/40 bg-card/30 backdrop-blur-md overflow-hidden">
                    <div className="border-b border-border/40 bg-muted/20 px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary" />
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">Regional Node Deployment</span>
                      </div>
                      <span className="text-[9px] font-mono text-neon uppercase tracking-tighter">Live Monitor</span>
                    </div>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {[
                          { region: "North America (US-East)", status: "Active", load: "12%", color: "bg-neon" },
                          { region: "Europe (EU-Central)", status: "Active", load: "08%", color: "bg-neon" },
                          { region: "Asia Pacific (SG-1)", status: "Limited", load: "94%", color: "bg-amber-500" },
                        ].map((node, i) => (
                          <div key={i} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              <div className={`h-1.5 w-1.5 rounded-full ${node.color} shadow-[0_0_8px_rgba(var(--neon),0.5)]`} />
                              <span className="text-xs font-medium text-muted-foreground group-hover:text-white transition-colors">{node.region}</span>
                            </div>
                            <div className="flex items-center gap-4 font-mono text-[10px]">
                              <span className="text-muted-foreground/50">LOAD: {node.load}</span>
                              <span className="font-bold">{node.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Infrastructure Access Panel */}
                <Card className="border-border/40 bg-card/30 backdrop-blur-md overflow-hidden flex flex-col">
                  <div className="border-b border-border/40 bg-muted/20 px-6 py-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <LockIcon className="h-4 w-4 text-primary" />
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">Node Access Protocol</span>
                    </div>
                    <Activity className="h-3 w-3 text-neon animate-pulse" />
                  </div>
                  <CardContent className="p-6 flex-1 space-y-6">
                    {[
                      { label: "Provisioned Corporate IP", value: terminalId, icon: Globe },
                      { label: "Identity Hash", value: user?.id?.slice(0, 16) || "N/A", icon: ShieldIcon },
                      { label: "Encrypted Vector", value: primary ? "Primary Active" : "Unassigned", icon: LockIcon },
                    ].map((item, i) => (
                      <div key={i} className="space-y-2.5">
                        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                          <item.icon className="h-3 w-3" /> {item.label}
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-white/5 bg-background/60 px-4 py-3 font-mono text-xs group transition-all hover:border-primary/40">
                          <span className="truncate max-w-[180px]">{item.value}</span>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-40 group-hover:opacity-100 hover:text-primary transition-all" onClick={() => {
                            navigator.clipboard.writeText(item.value);
                            toast.success("Identity key copied");
                          }}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    <div className="pt-2">
                      <div className="rounded-lg bg-primary/5 border border-primary/10 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-primary tracking-tighter">Security Posture</span>
                          <span className="text-[9px] font-mono text-neon font-bold uppercase">Optimal</span>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-primary w-[98%] shadow-[0_0_8px_var(--color-primary)]" />
                        </div>
                        <p className="text-[9px] text-muted-foreground leading-tight italic">
                          "All infrastructure assets are operating under AES-256 standard and multi-layered protection protocols."
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </SidebarInset>
      </div>
      
      <SecurityWelcomeDialog />
      <TutorialHintDialog open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </SidebarProvider>
  )
}
