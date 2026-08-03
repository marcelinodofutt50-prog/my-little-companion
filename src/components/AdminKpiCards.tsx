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
    <div className="enterprise-surface group relative overflow-hidden p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div className={`absolute left-0 top-0 h-full w-1 opacity-20 ${color.replace('text-', 'bg-')}`} />
      <div className="flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
        <span className="truncate">{label}</span>
        <Icon className={`h-3.5 w-3.5 shrink-0 opacity-70 ${color}`} />
      </div>
      <div className={`mt-3 font-display text-3xl font-extrabold leading-none tracking-tight tabular-nums ${color}`}>{value}</div>
      {sub && <div className="mt-2.5 font-mono text-[9px] font-medium uppercase tracking-wider text-muted-foreground/40">{sub}</div>}
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
