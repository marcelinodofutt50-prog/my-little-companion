import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2,
  Loader2, RefreshCw, Sparkles, TrendingUp, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminHealthMonitor } from "@/lib/admin.functions";

type Issue = {
  key: string; source: string; action: string | null; outcome: string | null;
  count: number; prevCount: number; delta: number; isNew: boolean; isRegression: boolean;
  severity: "critical" | "warn" | "info";
  firstAt: string; lastAt: string; lastError: string | null; statuses: number[];
};

type Health = {
  generated_at: string;
  hours: number;
  status: "healthy" | "degraded" | "critical";
  totals: { events: number; failures: number; prevFailures: number };
  errorRate: number; prevErrorRate: number;
  p95: number | null; prevP95: number | null;
  buckets: { hour: string; total: number; failures: number }[];
  issues: Issue[];
  regressions: number;
  signals: { stuckOrders: number; overdueRefunds: number; failedApkJobs: number };
};

const STATUS_META = {
  healthy: { label: "Tudo estável", tone: "text-neon", ring: "border-neon/40 bg-neon/5", dot: "bg-neon", Icon: CheckCircle2 },
  degraded: { label: "Atenção", tone: "text-amber-400", ring: "border-amber-500/40 bg-amber-500/5", dot: "bg-amber-400", Icon: AlertTriangle },
  critical: { label: "Falha crítica", tone: "text-destructive", ring: "border-destructive/50 bg-destructive/10", dot: "bg-destructive", Icon: AlertTriangle },
} as const;

function pct(n: number) {
  return `${(n * 100).toFixed(n >= 0.1 ? 0 : 1)}%`;
}

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min atrás`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.round(h / 24)}d atrás`;
}

function Metric({
  label, value, sub, trend, tone = "text-foreground",
}: { label: string; value: string; sub?: string; trend?: number | null; tone?: string }) {
  const up = typeof trend === "number" && trend > 0;
  const down = typeof trend === "number" && trend < 0;
  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-3 sm:p-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1.5 flex items-baseline gap-2 ${tone}`}>
        <span className="text-xl font-bold tabular-nums sm:text-2xl">{value}</span>
        {(up || down) && (
          <span className={`inline-flex items-center gap-0.5 font-mono text-[10px] ${up ? "text-destructive" : "text-neon"}`}>
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend as number)}%
          </span>
        )}
      </div>
      {sub && <div className="mt-1 font-mono text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Sparkbars({ buckets }: { buckets: Health["buckets"] }) {
  const max = Math.max(1, ...buckets.map((b) => b.total));
  return (
    <div className="flex h-16 items-end gap-[3px]">
      {buckets.map((b) => {
        const h = Math.max(3, Math.round((b.total / max) * 100));
        const fh = b.total ? Math.round((b.failures / b.total) * h) : 0;
        return (
          <div
            key={b.hour}
            className="group relative flex-1 rounded-sm bg-neon/25"
            style={{ height: `${h}%` }}
            title={`${new Date(b.hour).toLocaleTimeString("pt-BR", { hour: "2-digit" })}h · ${b.total} eventos · ${b.failures} falhas`}
          >
            {fh > 0 && (
              <div className="absolute inset-x-0 bottom-0 rounded-sm bg-destructive/80" style={{ height: `${(fh / h) * 100}%` }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AdminHealthPanel({ onOpenLogs }: { onOpenLogs?: () => void }) {
  const monitorFn = useServerFn(adminHealthMonitor);
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [auto, setAuto] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await monitorFn({ data: { hours } });
      setData(r as Health);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, [monitorFn, hours]);

  useEffect(() => {
    setLoading(true);
    load();
    if (!auto) return;
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load, auto]);

  const meta = STATUS_META[data?.status ?? "healthy"];
  const signals = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Pedidos travados em processamento", value: data.signals.stuckOrders, hint: "> 30 min sem concluir" },
      { label: "Reembolsos fora do prazo", value: data.signals.overdueRefunds, hint: "deadline de 2 dias vencido" },
      { label: "Jobs de APK com falha", value: data.signals.failedApkJobs, hint: `últimas ${data.hours}h` },
    ].filter((s) => s.value > 0);
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Cabeçalho de status */}
      <div className={`rounded-xl border p-4 sm:p-5 ${meta.ring}`}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border ${meta.ring}`}>
              <meta.Icon className={`h-5 w-5 ${meta.tone}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot} ${data?.status !== "healthy" ? "animate-pulse" : ""}`} />
                <h3 className={`truncate font-mono text-sm uppercase tracking-wider ${meta.tone}`}>{meta.label}</h3>
              </div>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                {loading && !data ? "coletando telemetria..." : `atualizado ${data ? relative(data.generated_at) : "—"} · janela de ${hours}h`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="hidden overflow-hidden rounded-md border border-border/40 font-mono text-[10px] uppercase sm:flex">
              {[6, 24, 72].map((h) => (
                <button
                  key={h}
                  onClick={() => setHours(h)}
                  className={`px-2.5 py-1.5 transition-colors ${hours === h ? "bg-neon/15 text-neon" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {h}h
                </button>
              ))}
            </div>
            <Button
              size="sm" variant="outline"
              onClick={() => setAuto((a) => !a)}
              className={`h-9 font-mono text-[10px] uppercase ${auto ? "text-neon" : "text-muted-foreground"}`}
              title="Atualização automática a cada 60s"
            >
              <Zap className="h-3 w-3" />
              <span className="ml-1 hidden sm:inline">{auto ? "auto" : "manual"}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={load} className="h-9 min-w-9 font-mono text-[10px] uppercase" aria-label="Atualizar">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {/* Seletor de janela no mobile */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:hidden">
          {[6, 24, 72].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={`rounded border px-2 py-2 font-mono text-[10px] uppercase ${hours === h ? "border-neon/50 bg-neon/10 text-neon" : "border-border/40 text-muted-foreground"}`}
            >
              {h}h
            </button>
          ))}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Taxa de erro"
          value={data ? pct(data.errorRate) : "—"}
          sub={data ? `${data.totals.failures} de ${data.totals.events} eventos` : undefined}
          tone={data && data.errorRate > 0.1 ? "text-destructive" : "text-foreground"}
          trend={data && data.prevErrorRate > 0 ? Math.round(((data.errorRate - data.prevErrorRate) / data.prevErrorRate) * 100) : null}
        />
        <Metric
          label="Falhas na janela"
          value={data ? String(data.totals.failures) : "—"}
          sub={data ? `período anterior: ${data.totals.prevFailures}` : undefined}
        />
        <Metric
          label="Latência p95"
          value={data?.p95 ? `${data.p95}ms` : "—"}
          sub={data?.prevP95 ? `antes: ${data.prevP95}ms` : "sem amostras"}
          trend={data?.p95 && data?.prevP95 ? Math.round(((data.p95 - data.prevP95) / data.prevP95) * 100) : null}
        />
        <Metric
          label="Regressões"
          value={data ? String(data.regressions) : "—"}
          sub="erros novos ou em alta"
          tone={data && data.regressions > 0 ? "text-amber-400" : "text-foreground"}
        />
      </div>

      {/* Volume por hora */}
      <div className="terminal-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-cyan">
            <TrendingUp className="h-3.5 w-3.5" /> volume por hora
          </div>
          <div className="flex items-center gap-3 font-mono text-[9px] uppercase text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-neon/40" /> ok</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-destructive/80" /> falha</span>
          </div>
        </div>
        {data ? <Sparkbars buckets={data.buckets} /> : <div className="h-16 animate-pulse rounded bg-muted/20" />}
      </div>

      {/* Sinais de negócio */}
      {signals.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {signals.map((s) => (
            <div key={s.label} className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <div className="text-xl font-bold text-amber-400 tabular-nums">{s.value}</div>
              <div className="mt-0.5 text-xs text-foreground/90">{s.label}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{s.hint}</div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de problemas */}
      <div className="terminal-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/40 p-3">
          <Activity className="h-4 w-4 text-neon" />
          <span className="font-mono text-xs uppercase tracking-wider text-cyan">// erros agrupados</span>
          {onOpenLogs && (
            <Button size="sm" variant="ghost" onClick={onOpenLogs} className="ml-auto h-8 font-mono text-[10px] uppercase text-muted-foreground">
              ver logs brutos
            </Button>
          )}
        </div>

        {!data && <div className="p-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></div>}

        {data && data.issues.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Sparkles className="h-8 w-8 text-neon/60" />
            <div className="font-mono text-xs uppercase text-neon">nenhum erro nas últimas {hours}h</div>
            <p className="max-w-sm text-xs text-muted-foreground">Todas as integrações responderam com sucesso. O monitor continua rodando em segundo plano.</p>
          </div>
        )}

        <div className="divide-y divide-border/30">
          {data?.issues.map((i) => {
            const open = openKey === i.key;
            const tone = i.severity === "critical" ? "text-destructive" : i.severity === "warn" ? "text-amber-400" : "text-muted-foreground";
            return (
              <div key={i.key}>
                <button
                  onClick={() => setOpenKey(open ? null : i.key)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-background/40"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${i.severity === "critical" ? "bg-destructive" : i.severity === "warn" ? "bg-amber-400" : "bg-muted-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs text-foreground">{i.source}</span>
                      {i.action && <span className="font-mono text-[10px] text-muted-foreground">· {i.action}</span>}
                      <span className={`rounded border border-border/40 px-1.5 py-0.5 font-mono text-[9px] uppercase ${tone}`}>{i.outcome}</span>
                      {i.isNew && <span className="rounded bg-destructive/20 px-1.5 py-0.5 font-mono text-[9px] uppercase text-destructive">novo</span>}
                      {!i.isNew && i.isRegression && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] uppercase text-amber-400">regressão +{i.delta}%</span>}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                      {i.count}× · último {relative(i.lastAt)}
                      {i.statuses.length > 0 && ` · HTTP ${i.statuses.join(", ")}`}
                    </div>
                  </div>
                  <span className={`shrink-0 font-mono text-sm font-bold tabular-nums ${tone}`}>{i.count}</span>
                </button>
                {open && (
                  <div className="space-y-2 border-t border-border/20 bg-background/30 p-3">
                    <div className="grid gap-2 font-mono text-[10px] sm:grid-cols-3">
                      <div><span className="text-muted-foreground">período anterior:</span> {i.prevCount}×</div>
                      <div><span className="text-muted-foreground">primeiro:</span> {new Date(i.firstAt).toLocaleString("pt-BR")}</div>
                      <div><span className="text-muted-foreground">último:</span> {new Date(i.lastAt).toLocaleString("pt-BR")}</div>
                    </div>
                    {i.lastError && (
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-border/40 bg-background/60 p-2 font-mono text-[10px] text-destructive/90">
                        {i.lastError}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
