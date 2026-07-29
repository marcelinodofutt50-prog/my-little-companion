import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PackageCheck, RotateCcw, AlertTriangle, Gift, Receipt, Search, Filter, CalendarRange, X, Clock } from "lucide-react";
import { listMyOrders, type MyOrder } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";

const STAGE_META: Record<string, { label: string; cls: string; icon: typeof PackageCheck }> = {
  delivered: { label: "entregue", cls: "border-neon/40 bg-neon/10 text-neon", icon: PackageCheck },
  refunded: { label: "reembolsado", cls: "border-violet/40 bg-violet/10 text-violet", icon: RotateCcw },
  failed: { label: "falhou", cls: "border-danger/40 bg-danger/10 text-danger", icon: AlertTriangle },
  pending: { label: "pendente", cls: "border-amber/40 bg-amber/10 text-amber-400", icon: Clock },
  processing: { label: "processando", cls: "border-cyan/40 bg-cyan/10 text-cyan", icon: Clock },
};

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

type StageFilter = "all" | "andamento" | "delivered" | "refunded" | "failed";
type PeriodFilter = "all" | "7d" | "30d" | "90d" | "year";

const STAGE_TABS: { key: StageFilter; label: string }[] = [
  { key: "all", label: "todos" },
  { key: "andamento", label: "andamento" },
  { key: "delivered", label: "entregues" },
  { key: "refunded", label: "reembolsados" },
  { key: "failed", label: "falhas" },
];

const PERIOD_TABS: { key: PeriodFilter; label: string; days: number | null }[] = [
  { key: "all", label: "todo período", days: null },
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "90d", label: "90 dias", days: 90 },
  { key: "year", label: "12 meses", days: 365 },
];

/** Histórico de todos os pedidos (concluídos e em andamento). */
export function OrderHistory() {
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<StageFilter>("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
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
  // Aceita "#a1b2c3", "A1B2C3", id completo ou parte do nome do plano.
  const raw = q.trim().toLowerCase();
  const term = raw.replace(/^#/, "").replace(/\s+/g, "");
  const days = PERIOD_TABS.find((p) => p.key === period)?.days ?? null;
  const cutoff = days ? Date.now() - days * 86400000 : null;

  const matches = (o: MyOrder) => {
    if (!term) return true;
    const id = o.id.toLowerCase();
    if (id.includes(term) || id.replace(/-/g, "").includes(term.replace(/-/g, ""))) return true;
    return (o.plan_name ?? o.plan_slug).toLowerCase().includes(raw);
  };

  const list = orders.filter((o) => {
    if (stage !== "all") {
      if (stage === "andamento") {
        if (o.stage === "delivered" || o.stage === "refunded" || o.stage === "failed") return false;
      } else if (o.stage !== stage) {
        return false;
      }
    }
    if (cutoff && new Date(o.created_at).getTime() < cutoff) return false;
    return matches(o);
  });


  const totalPago = done
    .filter((o) => o.stage === "delivered")
    .reduce((s, o) => s + o.amount, 0);

  const filtersOn = stage !== "all" || period !== "all" || term.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total de pedidos" value={String(orders.length)} />
        <Stat label="Total investido" value={`R$ ${totalPago.toFixed(2).replace(".", ",")}`} />
        <Stat label="Entregas automáticas" value={`${done.filter((o) => o.stage === "delivered").length}`} />
      </div>

      <div className="flex items-center gap-2 rounded border border-border/40 bg-background/40 px-3 py-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="buscar por nº do pedido (ex: #a1b2c3) ou plano"
          className="w-full bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      <div className="space-y-2">
        <FilterRow
          icon={<Filter className="h-3 w-3" />}
          label="status"
          options={STAGE_TABS}
          active={stage}
          onSelect={(k) => setStage(k as StageFilter)}
        />
        <FilterRow
          icon={<CalendarRange className="h-3 w-3" />}
          label="período"
          options={PERIOD_TABS}
          active={period}
          onSelect={(k) => setPeriod(k as PeriodFilter)}
        />
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>
            {list.length} de {done.length} pedido{done.length === 1 ? "" : "s"}
          </span>
          {filtersOn && (
            <button
              onClick={() => {
                setStage("all");
                setPeriod("all");
                setQ("");
              }}
              className="flex items-center gap-1 uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3 w-3" /> limpar filtros
            </button>
          )}
        </div>
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

function FilterRow({
  icon,
  label,
  options,
  active,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  options: { key: string; label: string }[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        {icon} {label}
      </span>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onSelect(o.key)}
          className={`rounded border px-2 py-0.5 font-mono text-[10px] transition-colors ${
            active === o.key
              ? "border-neon/50 bg-neon/10 text-neon"
              : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
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
