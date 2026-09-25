import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Wallet, CircleDollarSign, Undo2, Send, AlertTriangle } from "lucide-react";
import { adminRevenueSummary } from "@/lib/admin.functions";
import { formatBrl } from "@/lib/plans";

type Summary = Awaited<ReturnType<typeof adminRevenueSummary>>;

function Stat({
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
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  paid: "Pagos",
  pending: "Aguardando pagamento",
  failed: "Falharam",
  cancelled: "Cancelados",
};

const STATUS_DOT: Record<string, string> = {
  paid: "bg-primary",
  pending: "bg-amber-400",
  failed: "bg-destructive",
  cancelled: "bg-muted-foreground",
};

export function AdminRevenuePanel() {
  const fn = useServerFn(adminRevenueSummary);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    return fn({} as any)
      .then((r: Summary) => { setData(r); setError(null); })
      .catch((e: any) => setError(e?.message ?? "Não foi possível carregar o caixa."))
      .finally(() => setLoading(false));
  }, [fn]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Somando os pedidos pagos…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <span className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" /> Não foi possível carregar o caixa. {error}
        </span>
        <button onClick={() => void load()} className="rounded border border-border/60 px-2 py-1 text-xs hover:border-primary/50">
          Tentar de novo
        </button>
      </div>
    );
  }

  if (!data) return null;

  const total = data.ordersTotal || 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Caixa — valores reais</h3>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>base {data.backendHost}</span>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1 rounded border border-border/60 px-2 py-1 hover:border-primary/50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Saldo da conta"
          value={formatBrl(data.balance)}
          hint="recebido menos reembolsos e repasses"
          tone="neon"
          icon={<Wallet className="h-4 w-4" />}
        />
        <Stat
          label="Receita total"
          value={formatBrl(data.grossTotal)}
          hint={`${data.byStatus.paid} pedidos pagos${data.lastPaidAt ? ` · último em ${new Date(data.lastPaidAt).toLocaleDateString("pt-BR")}` : ""}`}
          tone="violet"
          icon={<CircleDollarSign className="h-4 w-4" />}
        />
        <Stat
          label="Reembolsos"
          value={formatBrl(data.refundsTotal)}
          hint={data.refundsPending ? `${data.refundsPending} pedido(s) de reembolso em aberto` : "nenhum pedido em aberto"}
          tone={data.refundsPending ? "danger" : "cyan"}
          icon={<Undo2 className="h-4 w-4" />}
        />
        <Stat
          label="Repasses pagos"
          value={formatBrl(data.payoutsTotal)}
          hint={data.payoutsPending ? `${data.payoutsPending} repasse(s) aguardando` : "nada aguardando"}
          tone="cyan"
          icon={<Send className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card/60 p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Recebido no período</div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Hoje</span>
              <span className="font-semibold tabular-nums">{formatBrl(data.grossToday)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Este mês</span>
              <span className="font-semibold tabular-nums">{formatBrl(data.grossMonth)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Desde o início</span>
              <span className="font-semibold tabular-nums">{formatBrl(data.grossTotal)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/60 p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Status dos pedidos · {data.ordersTotal} no total
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {(["paid", "pending", "failed", "cancelled"] as const).map((k) => (
              <div key={k} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[k]}`} />
                    {STATUS_LABEL[k]}
                  </span>
                  <span className="tabular-nums">
                    {data.byStatus[k]} · {formatBrl(data.amountByStatus[k])}
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded bg-border/40">
                  <div
                    className={`h-full ${STATUS_DOT[k]}`}
                    style={{ width: `${Math.round((data.byStatus[k] / total) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
