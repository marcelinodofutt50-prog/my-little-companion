import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, HelpCircle, Loader2, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { staffAuditPanelIntegrity, staffPanelIntegrityHistory } from "@/lib/panel-integrity.functions";
import { adminHealLicenseLogin } from "@/lib/admin.functions";

type Row = {
  licenseId: string;
  userId: string;
  email: string;
  panel: string;
  planSlug: string | null;
  expiresAt: string | null;
  status: "ok" | "repaired" | "missing" | "unknown" | "no_password";
  detail?: string;
};

const STATUS_META: Record<Row["status"], { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  ok: { label: "No painel", tone: "text-emerald-400 border-emerald-500/40", icon: CheckCircle2 },
  repaired: { label: "Recriado", tone: "text-cyan-400 border-cyan-500/40", icon: Wrench },
  missing: { label: "Sumiu do painel", tone: "text-danger border-danger/40", icon: AlertTriangle },
  no_password: { label: "Sem senha guardada", tone: "text-amber-400 border-amber-500/40", icon: AlertTriangle },
  unknown: { label: "Painel não respondeu", tone: "text-muted-foreground border-border/50", icon: HelpCircle },
};

const fmt = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

/**
 * Conferência painel Yaarsa ↔ site: mostra logins que o site considera ativos
 * mas que não existem mais no painel, e recria automaticamente com a mesma
 * senha do cliente.
 */
export function AdminPanelIntegrityPanel() {
  const auditFn = useServerFn(staffAuditPanelIntegrity);
  const historyFn = useServerFn(staffPanelIntegrityHistory);

  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<{ checked: number; ok: number; repaired: number; missing: number; unknown: number } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [healing, setHealing] = useState<string | null>(null);
  const healFn = useServerFn(adminHealLicenseLogin);

  const heal = useCallback(
    async (licenseId: string) => {
      setHealing(licenseId);
      try {
        const res: any = await healFn({ data: { licenseId } });
        toast.success(
          res?.action === "recreated"
            ? `Login novo emitido: ${res.credentials.email}`
            : "Conta recriada no painel com as mesmas credenciais.",
          { description: res?.message },
        );
      } catch (e: any) {
        toast.error(e?.message ?? "Não foi possível corrigir este login.");
      } finally {
        setHealing(null);
      }
    },
    [healFn],
  );

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res: any = await historyFn({});
      setHistory(res?.events ?? []);
    } catch {
      /* histórico é complementar */
    } finally {
      setLoadingHistory(false);
    }
  }, [historyFn]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const run = useCallback(
    async (autoRepair: boolean) => {
      setRunning(true);
      const toastId = toast.loading(autoRepair ? "Conferindo e recriando logins ausentes…" : "Conferindo logins no painel…");
      try {
        const res: any = await auditFn({ data: { limit: 60, autoRepair } });
        if (res?.ok === false) throw new Error(res.message ?? "Falha na conferência.");
        const report = res.report;
        setRows(report.rows ?? []);
        setSummary({
          checked: report.checked,
          ok: report.ok,
          repaired: report.repaired,
          missing: report.missing,
          unknown: report.unknown,
        });
        toast.success(
          `${report.checked} login(s) conferido(s) · ${report.repaired} recriado(s) · ${report.missing} pendente(s)`,
          { id: toastId },
        );
        void loadHistory();
      } catch (e: any) {
        toast.error(e?.message ?? "Não foi possível conferir o painel agora.", { id: toastId });
      } finally {
        setRunning(false);
      }
    },
    [auditFn, loadHistory],
  );

  const problems = rows.filter((r) => r.status !== "ok");

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/50 bg-background/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-primary">
              <ShieldCheck className="h-4 w-4" /> Integridade dos logins
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Compara cada licença ativa do site com o painel Yaarsa. Quando a conta some do painel (acontece de
              madrugada), o sistema recria com a mesma senha e a mesma validade — sem precisar pedir nada ao cliente.
              Isso também roda sozinho na manutenção diária.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={running} onClick={() => void run(false)}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Só conferir
            </Button>
            <Button size="sm" disabled={running} onClick={() => void run(true)}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
              Conferir e corrigir
            </Button>
          </div>
        </div>

        {summary && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { label: "Conferidos", value: summary.checked, tone: "text-foreground" },
              { label: "No painel", value: summary.ok, tone: "text-emerald-400" },
              { label: "Recriados", value: summary.repaired, tone: "text-cyan-400" },
              { label: "Pendentes", value: summary.missing, tone: "text-danger" },
              { label: "Sem resposta", value: summary.unknown, tone: "text-amber-400" },
            ].map((s) => (
              <div key={s.label} className="rounded-md border border-border/50 bg-background/60 p-3">
                <div className={`font-mono text-xl ${s.tone}`}>{s.value}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {problems.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Resultado da última conferência
          </h3>
          {problems.map((r) => {
            const meta = STATUS_META[r.status];
            const Icon = meta.icon;
            return (
              <div key={r.licenseId} className={`rounded-md border bg-background/40 p-3 ${meta.tone}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="font-mono text-xs uppercase tracking-widest">{meta.label}</span>
                  <span className="text-xs text-foreground">{r.email}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {r.panel} · {r.planSlug ?? "—"} · vence {fmt(r.expiresAt)}
                  </span>
                </div>
                {r.detail && <p className="mt-1 text-[11px] text-muted-foreground">{r.detail}</p>}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={healing === r.licenseId}
                  onClick={() => void heal(r.licenseId)}
                >
                  {healing === r.licenseId ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wrench className="mr-2 h-4 w-4" />
                  )}
                  Corrigir login deste cliente
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Histórico automático (últimas ocorrências)
        </h3>
        {loadingHistory ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma divergência registrada até agora.</p>
        ) : (
          history.map((h) => (
            <div key={h.id} className="rounded-md border border-border/50 bg-background/40 p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {fmt(h.created_at)}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-primary">{h.outcome}</span>
                {h.context?.email && <span className="text-foreground">{h.context.email}</span>}
                {h.context?.panel && <span className="text-muted-foreground">({h.context.panel})</span>}
                {h.action === "audit" && h.context && (
                  <span className="text-muted-foreground">
                    {h.context.checked} conferidos · {h.context.repaired} recriados · {h.context.missing} pendentes
                  </span>
                )}
              </div>
              {h.error && <p className="mt-1 text-[11px] text-danger">{h.error}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
