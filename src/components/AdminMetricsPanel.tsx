import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, TrendingDown, Undo2, Timer, Target, Loader2 } from "lucide-react";
import { adminMetrics } from "@/lib/admin.functions";
import { formatBrl } from "@/lib/plans";

type Metrics = Awaited<ReturnType<typeof adminMetrics>>;

function Card({
  label, value, hint, icon, tone = "cyan",
}: { label: string; value: string; hint?: string; icon: React.ReactNode; tone?: "cyan" | "neon" | "violet" | "danger" }) {
  const toneCls =
    tone === "danger" ? "text-destructive" : tone === "neon" ? "text-primary" : tone === "violet" ? "text-accent" : "text-primary";
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={toneCls}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function AdminMetricsPanel() {
  const fn = useServerFn(adminMetrics);
  const [m, setM] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fn({} as any)
      .then((r: Metrics) => { if (alive) setM(r); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fn]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Calculando métricas dos últimos 30 dias…
      </div>
    );
  }
  if (!m) return null;

  const growth = m.growth;
  const growthLabel = growth === null ? "sem base anterior" : `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% vs. 30d anteriores`;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Métricas — últimos 30 dias</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Receita 30d"
          value={formatBrl(m.revenue30)}
          hint={growthLabel}
          tone={growth !== null && growth < 0 ? "danger" : "neon"}
          icon={growth !== null && growth < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
        />
        <Card
          label="Conversão"
          value={m.conversion === null ? "—" : `${m.conversion.toFixed(1)}%`}
          hint={`${m.paidCount} pagos de ${m.attempts} pedidos · ticket ${formatBrl(m.ticket)}`}
          tone="violet"
          icon={<Target className="h-4 w-4" />}
        />
        <Card
          label="Taxa de reembolso"
          value={`${m.refundRate.toFixed(1)}%`}
          hint={`${m.refundCount} reembolsos · ${formatBrl(m.refundAmount)}${m.refundsPending ? ` · ${m.refundsPending} pendente(s)` : ""}`}
          tone={m.refundRate > 10 ? "danger" : "cyan"}
          icon={<Undo2 className="h-4 w-4" />}
        />
        <Card
          label="Resposta média"
          value={m.avgResponseMin === null ? "—" : m.avgResponseMin >= 60 ? `${(m.avgResponseMin / 60).toFixed(1)} h` : `${m.avgResponseMin} min`}
          hint={`${m.threadsAnswered} respostas medidas`}
          tone={m.avgResponseMin !== null && m.avgResponseMin > 120 ? "danger" : "neon"}
          icon={<Timer className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}
