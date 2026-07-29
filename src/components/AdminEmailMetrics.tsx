import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, MailCheck, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEmailMetrics } from "@/lib/email-metrics.functions";

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded border border-border/60 bg-background/40 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-xl ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

export function AdminEmailMetrics() {
  const fetchMetrics = useServerFn(getEmailMetrics);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-email-metrics"],
    queryFn: () => fetchMetrics({ data: { hours: 24 } }),
    refetchInterval: 60_000,
  });

  const rateLimited = data?.rateLimited ?? 0;
  const domainHealthy = rateLimited === 0 && (data?.failed ?? 0) === 0;

  return (
    <div className="terminal-card scanlines relative p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-neon">
          Envio de e-mails · 24h
        </h3>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">Carregando métricas...</p>
      ) : (
        <>
          <div
            className={`mt-3 flex items-center gap-2 rounded border px-3 py-2 font-mono text-[11px] ${
              domainHealthy
                ? "border-neon/40 bg-neon/5 text-neon"
                : "border-amber-400/40 bg-amber-400/5 text-amber-400"
            }`}
          >
            {domainHealthy ? <MailCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
            <span>
              {domainHealthy
                ? "Entrega estável — nenhum bloqueio nas últimas 24h."
                : `Cota do remetente sob pressão: ${rateLimited} bloqueio(s) por limite. Verificar domínio de envio.`}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Enviados" value={data?.sent ?? 0} tone="text-neon" />
            <Stat label="Falhas" value={data?.failed ?? 0} tone="text-destructive" />
            <Stat label="Rate limit" value={rateLimited} tone="text-amber-400" />
            <Stat label="Taxa sucesso" value={`${data?.successRate ?? 100}%`} />
          </div>

          {data?.lastRateLimitAt && (
            <p className="mt-2 flex items-center gap-1 font-mono text-[10px] text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              Último rate limit: {new Date(data.lastRateLimitAt).toLocaleString("pt-BR")}
            </p>
          )}

          {!!data?.byAction.length && (
            <div className="mt-3 space-y-1">
              {data.byAction.map((a) => (
                <div
                  key={a.action}
                  className="flex items-center justify-between rounded border border-border/40 px-2 py-1 font-mono text-[10px]"
                >
                  <span className="uppercase tracking-wider text-muted-foreground">{a.action}</span>
                  <span className="flex gap-3">
                    <span className="text-neon">ok {a.sent}</span>
                    <span className="text-destructive">err {a.failed}</span>
                    <span className="text-amber-400">429 {a.rateLimited}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {!!data?.recent.length && (
            <div className="mt-3 max-h-48 overflow-y-auto rounded border border-border/40">
              {data.recent.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 border-b border-border/30 px-2 py-1 font-mono text-[10px] last:border-0"
                >
                  <span className="text-muted-foreground">
                    {new Date(r.at).toLocaleTimeString("pt-BR")}
                  </span>
                  <span className="truncate">{r.recipient ?? "—"}</span>
                  <span
                    className={
                      r.outcome === "sent"
                        ? "text-neon"
                        : r.outcome === "rate_limited"
                          ? "text-amber-400"
                          : "text-destructive"
                    }
                  >
                    {r.outcome}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
