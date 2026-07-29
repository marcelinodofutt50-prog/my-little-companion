import { DollarSign, Clock, LifeBuoy, TrendingUp } from "lucide-react";

export type AdminKpiValues = {
  revenueToday: string;
  pendingOrders: number;
  openTickets: number;
  conversionRate: string;
};

function KpiCard({
  icon: Icon, label, value, sub, accent,
}: { icon: any; label: string; value: string; sub?: string; accent: "neon" | "cyan" | "violet" | "amber" }) {
  const color =
    accent === "neon" ? "text-neon" : accent === "cyan" ? "text-cyan" : accent === "violet" ? "text-violet" : "text-amber-400";
  return (
    <div className="terminal-card group relative overflow-hidden rounded-xl border-border/60 p-4 transition-colors hover:border-foreground/20">
      <div className={`absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-50 ${color}`} />
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="truncate">{label}</span>
        <Icon className={`h-3.5 w-3.5 shrink-0 opacity-80 ${color}`} />
      </div>
      <div className={`mt-2.5 font-mono text-[26px] leading-none font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="mt-2 font-mono text-[10px] uppercase text-muted-foreground/60">{sub}</div>}
    </div>

  );
}

export function AdminKpiCards({ revenueToday, pendingOrders, openTickets, conversionRate }: AdminKpiValues) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
      <KpiCard icon={DollarSign} label="Receita do dia" value={revenueToday} sub="pedidos pagos hoje" accent="neon" />
      <KpiCard icon={Clock} label="Pedidos pendentes" value={String(pendingOrders)} sub="aguardando pagamento" accent="amber" />
      <KpiCard icon={LifeBuoy} label="Tickets abertos" value={String(openTickets)} sub="suporte ao vivo" accent="cyan" />
      <KpiCard icon={TrendingUp} label="Taxa de conversão" value={conversionRate} sub="pagos / total hoje" accent="violet" />
    </div>
  );
}
