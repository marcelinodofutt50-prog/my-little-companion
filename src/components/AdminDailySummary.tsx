import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock } from "lucide-react";
import { adminDailySummary } from "@/lib/admin-daily.functions";
import { cn } from "@/lib/utils";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Cards com o que aconteceu nas últimas 24 horas. */
export function AdminDailySummary() {
  const fn = useServerFn(adminDailySummary);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["admin-daily-summary"],
    queryFn: () => fn(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });

  const items = data
    ? [
        { label: "Vendas pagas", value: `${data.salesCount} · ${brl(data.salesTotal)}`, tone: "ok" },
        { label: "Pedidos parados antes do pagamento", value: String(data.stalledOrders), tone: data.stalledOrders > 0 ? "warn" : "ok" },
        { label: "Testes grátis criados", value: String(data.trialsCreated), tone: "ok" },
        { label: "Testes recusados (regras)", value: String(data.trialsBlocked), tone: "muted" },
        { label: "Reparos concluídos", value: String(data.repairsOk), tone: "ok" },
        { label: "Reparos com falha", value: String(data.repairsFailed), tone: data.repairsFailed > 0 ? "bad" : "ok" },
        { label: "Recusas do painel", value: String(data.panelErrors), tone: data.panelErrors > 0 ? "warn" : "ok" },
      ]
    : [];

  return (
    <section className="rounded-xl border border-border bg-card/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Resumo das últimas 24 horas</h3>
        {data && (
          <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {new Date(data.generatedAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </span>
        )}
      </div>
      {isPending ? (
        <p className="text-xs text-muted-foreground">Carregando resumo…</p>
      ) : error ? (
        <button onClick={() => void refetch()} className="text-xs text-destructive underline">
          Não foi possível carregar. Tentar de novo
        </button>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it) => (
            <div key={it.label} className="rounded-lg border border-border/60 bg-background/50 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.label}</div>
              <div
                className={cn(
                  "mt-1 font-mono text-lg font-bold",
                  it.tone === "ok" && "text-primary",
                  it.tone === "warn" && "text-amber-500",
                  it.tone === "bad" && "text-destructive",
                  it.tone === "muted" && "text-muted-foreground",
                )}
              >
                {it.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
