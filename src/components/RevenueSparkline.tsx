import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatBrl } from "@/lib/plans";

type Order = { created_at: string; amount: number | string; status: string };

export function RevenueSparkline({ orders }: { orders: Order[] }) {
  const { days, total, prevTotal, delta } = useMemo(() => {
    const buckets: { date: string; label: string; amount: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      buckets.push({
        date: iso,
        label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
        amount: 0,
      });
    }
    const prevWindow = { from: new Date(), to: new Date() };
    prevWindow.to.setHours(0, 0, 0, 0);
    prevWindow.to.setDate(prevWindow.to.getDate() - 7);
    prevWindow.from.setHours(0, 0, 0, 0);
    prevWindow.from.setDate(prevWindow.from.getDate() - 14);

    let prevTotal = 0;
    for (const o of orders) {
      if (o.status !== "paid") continue;
      const dt = new Date(o.created_at);
      const iso = dt.toISOString().slice(0, 10);
      const bucket = buckets.find((b) => b.date === iso);
      if (bucket) bucket.amount += Number(o.amount || 0);
      else if (dt >= prevWindow.from && dt < prevWindow.to) {
        prevTotal += Number(o.amount || 0);
      }
    }
    const total = buckets.reduce((s, b) => s + b.amount, 0);
    const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : total > 0 ? 100 : 0;
    return { days: buckets, total, prevTotal, delta };
  }, [orders]);

  const max = Math.max(1, ...days.map((d) => d.amount));

  return (
    <div className="terminal-card scanlines relative p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-neon">
          <TrendingUp className="h-3.5 w-3.5" /> receita · últimos 7 dias
        </h3>
        <div
          className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
            delta >= 0
              ? "border-neon/40 bg-neon/10 text-neon"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
        >
          {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(0)}%
        </div>
      </div>

      <div className="mb-3">
        <div className="font-mono text-2xl font-bold text-foreground">{formatBrl(total)}</div>
        <div className="font-mono text-[10px] uppercase text-muted-foreground">
          vs {formatBrl(prevTotal)} na semana anterior
        </div>
      </div>

      <div className="flex h-24 items-end gap-1.5">
        {days.map((d, i) => {
          const h = (d.amount / max) * 100;
          const isToday = i === days.length - 1;
          return (
            <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
              <div className="relative w-full flex-1 flex items-end">
                <div
                  className={`w-full rounded-t transition-all ${
                    isToday ? "bg-neon shadow-[0_0_12px_var(--neon)]" : "bg-cyan/60 group-hover:bg-cyan"
                  }`}
                  style={{ height: `${Math.max(h, 2)}%` }}
                  title={`${d.label}: ${formatBrl(d.amount)}`}
                />
                {d.amount > 0 && (
                  <div className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-background/90 px-1 py-0.5 font-mono text-[9px] text-foreground opacity-0 group-hover:opacity-100">
                    {formatBrl(d.amount)}
                  </div>
                )}
              </div>
              <div className="font-mono text-[9px] uppercase text-muted-foreground">{d.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
