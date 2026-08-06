import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skull, AlertTriangle, Shield } from "lucide-react"

export const Route = createFileRoute('/_authenticated/servidor/kraken')({
  component: KrakenPage,
})

function KrakenPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-red-600 to-amber-600 bg-clip-text text-transparent">Kraken Control Unit</h2>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
            // Advanced Payload Injection & Command Console
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-red-900/20 bg-black/40 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="rounded-full bg-red-500/10 p-2">
              <Skull className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <CardTitle>Kraken Instance Status</CardTitle>
              <p className="text-xs text-muted-foreground">Monitoring active deployment nodes</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg border border-red-500/10 bg-red-500/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-red-400">STATUS: STANDBY</span>
                  <span className="text-[10px] text-muted-foreground">NO ACTIVE TARGETS</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                O módulo Kraken é a unidade de elite da Shadow Ops para interceptação e controle remoto. 
                Configure seus parâmetros de injeção abaixo para iniciar o provisionamento.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-amber-900/20 bg-black/40 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="rounded-full bg-amber-500/10 p-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <CardTitle>Security Protocol</CardTitle>
              <p className="text-xs text-muted-foreground">System constraints & logs</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <Shield className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-500/80">ENCRYPTION: AES-256-XTS</span>
              </div>
              <div className="h-[120px] rounded border border-white/5 bg-black/60 p-2 font-mono text-[10px] text-amber-500/70 overflow-hidden">
                [SYSTEM] Initializing Kraken environment...<br/>
                [SYSTEM] Checking hardware acceleration...<br/>
                [SYSTEM] Node 0xFA-88 synchronized.<br/>
                [SYSTEM] Ready for operator commands.<br/>
                <span className="animate-pulse">_</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
