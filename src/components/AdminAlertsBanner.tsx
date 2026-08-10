import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ShieldAlert, X, Activity } from "lucide-react";
import { adminGetAlerts } from "@/lib/admin.functions";

type Alert = {
  source: string;
  action: string | null;
  count: number;
  lastError: string | null;
  lastAt: string;
  httpStatuses: number[];
  severity: "critical" | "warn" | "info";
};

type AlertsResponse = {
  generated_at: string;
  failure_groups: Alert[];
  stuck_licenses: number;
  total_failures_1h: number;
};

export function AdminAlertsBanner({ onOpenLogs, onOpenIA }: { onOpenLogs: () => void; onOpenIA: () => void }) {
  const getAlerts = useServerFn(adminGetAlerts);
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await getAlerts();
        if (alive) setData(r as AlertsResponse);
      } catch { /* silencioso */ }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, [getAlerts]);

  if (!data) return null;
  const alerts = data.failure_groups;
  if (alerts.length === 0 && data.stuck_licenses === 0) return null;

  const key = `${data.generated_at}-${alerts.length}-${data.stuck_licenses}`;
  if (dismissed === key) return null;

  const worst = alerts.find((a) => a.severity === "critical") ?? alerts[0];
  const isCritical = worst?.severity === "critical";

  return (
    <div className={
      "mb-4 rounded border p-4 " +
      (isCritical
        ? "border-destructive/60 bg-destructive/10"
        : "border-yellow-500/50 bg-yellow-500/5")
    }>
      <div className="flex items-start gap-3">
        <div className={"rounded p-2 " + (isCritical ? "bg-destructive/20" : "bg-yellow-500/20")}>
          {isCritical ? (
            <ShieldAlert className="h-4 w-4 text-destructive" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className={"font-mono text-xs uppercase tracking-wider " + (isCritical ? "text-destructive" : "text-yellow-500")}>
                {isCritical ? "Falha crítica detectada" : "Falhas recorrentes detectadas"}
              </div>
              <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                {data.total_failures_1h} falha(s) na última hora
                {data.stuck_licenses > 0 && ` · ${data.stuck_licenses} licença(s) travada(s) em overdue`}
              </div>
            </div>
            <button
              onClick={() => setDismissed(key)}
              className="rounded p-1 text-muted-foreground hover:bg-background/60 hover:text-foreground"
              aria-label="Dispensar"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {alerts.length > 0 && (
            <div className="space-y-1">
              {alerts.slice(0, 4).map((a, i) => (
                <div key={i} className="rounded border border-border/40 bg-background/40 p-2 font-mono text-[10px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground">
                      <span className="uppercase text-neon">{a.source}</span>
                      {a.action && <span className="text-muted-foreground"> · {a.action}</span>}
                    </span>
                    <span className={
                      "rounded px-1.5 py-0.5 " +
                      (a.severity === "critical" ? "bg-destructive/20 text-destructive" : "bg-yellow-500/20 text-yellow-500")
                    }>
                      {a.count}x
                    </span>
                  </div>
                  {a.lastError && (
                    <div className="mt-1 truncate text-muted-foreground" title={a.lastError}>
                      {a.lastError}
                    </div>
                  )}
                  {a.httpStatuses.length > 0 && (
                    <div className="mt-0.5 text-muted-foreground">
                      HTTP: {Array.from(new Set(a.httpStatuses)).slice(0, 5).join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onOpenIA}
              className="rounded border border-neon/40 bg-neon/10 px-3 py-1.5 font-mono text-[10px] uppercase text-neon hover:bg-neon/20"
            >
              <Activity className="mr-1 inline h-3 w-3" /> Diagnosticar com IA
            </button>
            <button
              onClick={onOpenLogs}
              className="rounded border border-border/40 bg-background/60 px-3 py-1.5 font-mono text-[10px] uppercase text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            >
              Ver logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
