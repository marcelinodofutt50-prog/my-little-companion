import { Check, Clock, CreditCard, Key, PackageCheck } from "lucide-react";

export type OrderTimelineStatus = "pending" | "paid" | "processing" | "delivered" | "failed" | "refunded";

export type OrderTimelineData = {
  status: OrderTimelineStatus | string;
  created_at: string | null;
  paid_at?: string | null;
  processing_at?: string | null;
  delivered_at?: string | null;
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

export function OrderStatusTimeline({ order }: { order: OrderTimelineData }) {
  const failed = order.status === "failed" || order.status === "refunded";
  const activeIndex = stepIndexFor(order);

  return (
    <div className="terminal-card scanlines relative overflow-hidden rounded-lg border border-border/50 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/80">// status do pedido</div>
      {failed && (
        <div className="mt-2 rounded border border-danger/40 bg-danger/10 px-3 py-1.5 font-mono text-[11px] text-danger">
          Pedido {order.status === "refunded" ? "reembolsado" : "com falha"}
        </div>
      )}
      <div className="mt-3 flex items-center">
        {STEPS.map((step, i) => {
          const done = !failed && i <= activeIndex;
          const current = !failed && i === activeIndex;
          const Icon = step.icon;
          return (
            <div key={step.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                    done
                      ? "border-neon bg-neon/15 text-neon"
                      : "border-border/50 bg-background/40 text-muted-foreground"
                  } ${current ? "shadow-[0_0_14px_oklch(0.85_0.24_150/0.4)]" : ""}`}
                >
                  {done && !current ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span
                  className={`whitespace-nowrap font-mono text-[9px] uppercase tracking-wider ${
                    done ? "text-neon" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-1 h-px flex-1 ${i < activeIndex && !failed ? "bg-neon/60" : "bg-border/40"}`} />
              )}
            </div>
          );
        })}
      </div>
      {order.created_at && (
        <div className="mt-3 font-mono text-[10px] text-muted-foreground">
          criado em {new Date(order.created_at).toLocaleString("pt-BR")}
        </div>
      )}
    </div>
  );
}
