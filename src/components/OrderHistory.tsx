import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PackageCheck, RotateCcw, AlertTriangle, Gift, Receipt, Search } from "lucide-react";
import { listMyOrders, type MyOrder } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";

const STAGE_META: Record<string, { label: string; cls: string; icon: typeof PackageCheck }> = {
  delivered: { label: "entregue", cls: "border-neon/40 bg-neon/10 text-neon", icon: PackageCheck },
  refunded: { label: "reembolsado", cls: "border-violet/40 bg-violet/10 text-violet", icon: RotateCcw },
  failed: { label: "falhou", cls: "border-danger/40 bg-danger/10 text-danger", icon: AlertTriangle },
};

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

/** Histórico de pedidos já concluídos (entregues, reembolsados ou com falha). */
export function OrderHistory() {
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [q, setQ] = useState("");
  const fetchFn = useServerFn(listMyOrders);

  useEffect(() => {
    fetchFn()
      .then((r) => setOrders(r as MyOrder[]))
      .catch(() => setOrders([]));
  }, [fetchFn]);

  if (orders === null) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/40 p-6 font-mono text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> carregando histórico…
      </div>
    );
  }

  const done = orders.filter((o) => o.stage === "delivered" || o.stage === "refunded" || o.stage === "failed");
  const term = q.trim().toLowerCase();
  const list = term
    ? done.filter(
        (o) =>
          (o.plan_name ?? o.plan_slug).toLowerCase().includes(term) ||
          o.id.toLowerCase().includes(term),
      )
    : done;

  const totalPago = done
    .filter((o) => o.stage === "delivered")
    .reduce((s, o) => s + o.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Pedidos concluídos" value={String(done.length)} />
        <Stat label="Total investido" value={`R$ ${totalPago.toFixed(2).replace(".", ",")}`} />
        <Stat label="Entregas automáticas" value={`${done.filter((o) => o.stage === "delivered").length}`} />
      </div>

      <div className="flex items-center gap-2 rounded border border-border/40 bg-background/40 px-3 py-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="buscar por plano ou nº do pedido"
          className="w-full bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/50 p-8 text-center">
          <Receipt className="mx-auto h-6 w-6 text-muted-foreground/60" />
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            Nenhum pedido concluído por aqui ainda. Assim que uma compra for entregue, ela aparece neste histórico.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((o) => {
            const meta = STAGE_META[o.stage] ?? STAGE_META.delivered;
            const Icon = meta.icon;
            return (
              <div
                key={o.id}
                className="flex flex-col gap-2 rounded-lg border border-border/40 bg-card/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${meta.cls}`}>
                      <Icon className="h-3 w-3" /> {meta.label}
                    </span>
                    {o.is_gift && (
                      <span className="flex items-center gap-1 rounded border border-cyan/40 bg-cyan/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-cyan">
                        <Gift className="h-3 w-3" /> presente
                      </span>
                    )}
                    <span className="truncate text-sm font-medium">{o.plan_name ?? o.plan_slug}</span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                    #{o.id.slice(0, 8)} · criado {fmt(o.created_at)}
                    {o.delivered_at ? ` · entregue ${fmt(o.delivered_at)}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-mono text-sm text-foreground">R$ {o.amount.toFixed(2).replace(".", ",")}</div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-mono text-[10px] uppercase"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `Pedido ${o.id}\nPlano: ${o.plan_name ?? o.plan_slug}\nValor: R$ ${o.amount.toFixed(2)}\nStatus: ${meta.label}\nData: ${fmt(o.created_at)}`,
                      )
                    }
                  >
                    Recibo
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 p-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg text-foreground">{value}</div>
    </div>
  );
}
