import { Check, Clock, CreditCard, Key, PackageCheck, AlertTriangle, RotateCcw } from "lucide-react";

export type OrderTimelineStatus = "pending" | "paid" | "processing" | "delivered" | "failed" | "refunded";

export type OrderTimelineData = {
  id?: string;
  status: OrderTimelineStatus | string;
  created_at: string | null;
  paid_at?: string | null;
  processing_at?: string | null;
  delivered_at?: string | null;
  plan_name?: string | null;
  amount?: number | null;
};

const STEPS = [
  { key: "pending", label: "PIX pendente", icon: Clock },
  { key: "paid", label: "Pago", icon: CreditCard },
  { key: "processing", label: "Licença gerada", icon: Key },
  { key: "delivered", label: "Entregue", icon: PackageCheck },
] as const;

function stepIndexFor(order: OrderTimelineData): number {
  if (order.delivered_at || order.status === "delivered") return 3;
  if (order.processing_at || order.status === "processing") return 2;
  if (order.paid_at || order.status === "paid") return 1;
  return 0;
}

function fmt(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const HINTS: Record<number, string> = {
  0: "Aguardando confirmação do PIX — costuma levar menos de 1 minuto após o pagamento.",
  1: "Pagamento confirmado. Criando sua credencial no servidor…",
  2: "Credencial criada. Liberando o acesso no seu painel…",
  3: "Tudo pronto! Suas credenciais já estão disponíveis em Minhas licenças.",
};

export function OrderStatusTimeline({ order, compact = false }: { order: OrderTimelineData; compact?: boolean }) {
  const failed = order.status === "failed" || order.status === "yaarsa_failed" || order.status === "refunded";
  const refunded = order.status === "refunded";
  const activeIndex = stepIndexFor(order);
  const times = [order.created_at, order.paid_at, order.processing_at, order.delivered_at];
  const pct = failed ? 0 : (activeIndex / (STEPS.length - 1)) * 100;

  return (
    <div className="terminal-card scanlines relative overflow-hidden rounded-lg border border-border/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/80">// status do pedido</div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          {order.plan_name && <span className="text-foreground/80">{order.plan_name}</span>}
          {typeof order.amount === "number" && order.amount > 0 && (
            <span>· R$ {order.amount.toFixed(2).replace(".", ",")}</span>
          )}
          {order.id && <span className="opacity-60">· #{order.id.slice(0, 8)}</span>}
        </div>
      </div>

      {failed && (
        <div className="mt-2 flex items-center gap-2 rounded border border-danger/40 bg-danger/10 px-3 py-1.5 font-mono text-[11px] text-danger">
          {refunded ? <RotateCcw className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          Pedido {refunded ? "reembolsado" : "com falha — fale com o suporte para resolver na hora"}
        </div>
      )}

      <div className="relative mt-4">
        <div className="absolute left-4 right-4 top-4 h-px bg-border/40" />
        <div
          className="absolute left-4 top-4 h-px bg-neon/70 transition-all duration-700"
          style={{ width: `calc((100% - 2rem) * ${pct / 100})` }}
        />
        <div className="relative flex items-start justify-between">
          {STEPS.map((step, i) => {
            const done = !failed && i <= activeIndex;
            const current = !failed && i === activeIndex;
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex w-1/4 flex-col items-center gap-1.5 text-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                    done ? "border-neon bg-neon/15 text-neon" : "border-border/50 bg-background/60 text-muted-foreground"
                  } ${current ? "animate-pulse shadow-[0_0_14px_oklch(0.85_0.24_150/0.4)]" : ""}`}
                >
                  {done && !current ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={`font-mono text-[9px] uppercase leading-tight tracking-wider ${done ? "text-neon" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
                {fmt(times[i]) && (
                  <span className="font-mono text-[8px] text-muted-foreground/70">{fmt(times[i])}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!failed && !compact && (
        <div className="mt-3 rounded border border-border/40 bg-background/40 px-3 py-2 font-mono text-[10px] text-muted-foreground">
          {HINTS[activeIndex]}
        </div>
      )}
    </div>
  );
}
