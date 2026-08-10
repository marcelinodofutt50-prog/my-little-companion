import { useHealthMonitor, type HealthStatus } from "@/hooks/use-health-monitor";
import { Activity, ShieldCheck, MessageSquare, Palette, Cpu, AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_CONFIG = {
  healthy: { icon: CheckCircle2, color: "text-neon", bg: "bg-neon/10", border: "border-neon/20", label: "Estável" },
  degraded: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20", label: "Degradado" },
  critical: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", label: "Falha" },
  loading: { icon: Loader2, color: "text-muted-foreground", bg: "bg-muted/10", border: "border-border/20", label: "Checando" },
};

export function SystemHealthIndicator() {
  const { health, refetch } = useHealthMonitor();
  const config = STATUS_CONFIG[health.overall];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={`flex items-center gap-2 rounded-full border ${config.border} ${config.bg} px-3 py-1 transition-all hover:opacity-80`}>
          <div className="relative">
            <config.icon className={`h-3 w-3 ${config.color} ${health.overall === "loading" ? "animate-spin" : ""}`} />
            {health.overall !== "healthy" && health.overall !== "loading" && (
              <span className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full ${health.overall === "critical" ? "bg-destructive" : "bg-amber-400"}`} />
            )}
          </div>
          <span className="font-mono text-[9px] uppercase tracking-widest text-foreground">
            {health.overall === "healthy" ? "System Live" : health.overall === "degraded" ? "Attention" : "Sys Error"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 border-border/40 bg-background/95 p-0 backdrop-blur-md">
        <div className="hairline-b bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Shadow Health Monitor</span>
            <button onClick={() => refetch()} className="text-[9px] uppercase tracking-tighter text-neon hover:underline">Refetch</button>
          </div>
        </div>
        <div className="space-y-1 p-2">
          <HealthRow icon={ShieldCheck} label="Database" status={health.database} />
          <HealthRow icon={MessageSquare} label="Suporte Chat" status={health.support} />
          <HealthRow icon={Activity} label="Play Protect" status={health.playProtect} />
          <HealthRow icon={Palette} label="Theming" status={health.theme} />
          <HealthRow icon={Cpu} label="Modules" status={health.modules} />
        </div>
        
        {(health.failures.length > 0 || health.errors.length > 0) && (
          <div className="mt-2 border-t border-border/40 bg-destructive/5 p-3">
            <div className="mb-1.5 font-mono text-[9px] uppercase text-destructive">Recent Failures:</div>
            <div className="max-h-48 space-y-2 overflow-auto">
              {health.failures.map((f, i) => (
                <div key={`f-${i}`} className="rounded-sm border border-destructive/20 bg-destructive/5 p-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-destructive">
                      {f.scope} · {f.table}
                    </span>
                    {f.code && (
                      <span className="font-mono text-[8px] text-destructive/70">#{f.code}</span>
                    )}
                  </div>
                  <div className="mt-0.5 break-all font-mono text-[8px] leading-tight text-muted-foreground">
                    query: {f.query}
                  </div>
                  <div className="mt-0.5 break-words font-mono text-[9px] leading-tight text-destructive/90">
                    {f.message}
                  </div>
                  {f.details && (
                    <div className="mt-0.5 break-words font-mono text-[8px] leading-tight text-muted-foreground">
                      details: {f.details}
                    </div>
                  )}
                  {f.hint && (
                    <div className="mt-0.5 break-words font-mono text-[8px] leading-tight text-amber-400/80">
                      hint: {f.hint}
                    </div>
                  )}
                </div>
              ))}
              {health.errors
                .filter((e) => !health.failures.some((f) => e.includes(f.message)))
                .map((err, i) => (
                  <div key={`e-${i}`} className="font-mono text-[9px] leading-tight text-destructive/80">
                    {">"} {err}
                  </div>
                ))}
            </div>
          </div>
        )}
        
        <div className="p-2 pt-0">
          <div className="mt-2 flex items-center justify-between font-mono text-[8px] text-muted-foreground/60">
            <span>Last sync: {new Date(health.lastCheck).toLocaleTimeString()}</span>
            <span>Shadow v4.6.2</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function HealthRow({ icon: Icon, label, status }: { icon: any; label: string; status: HealthStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <div className="flex items-center justify-between rounded-md p-1.5 hover:bg-muted/20">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono text-[10px] text-foreground/80">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`font-mono text-[9px] uppercase ${config.color}`}>{config.label}</span>
        <div className={`h-1.5 w-1.5 rounded-full ${status === "healthy" ? "bg-neon" : status === "degraded" ? "bg-amber-400" : "bg-destructive"}`} />
      </div>
    </div>
  );
}
