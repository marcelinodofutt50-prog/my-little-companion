import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminCustomer360 } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  IdCard,
  Copy,
  RefreshCw,
  ShieldCheck,
  Wallet,
  ShoppingBag,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const brl = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
const dt = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

// Cache simples por usuário para não refazer a consulta a cada troca de conversa.
const ctxCache = new Map<string, any>();

function Chip({
  icon: Icon,
  label,
  value,
  tone = "muted",
  title,
}: {
  icon: any;
  label: string;
  value: string;
  tone?: "muted" | "good" | "warn" | "bad";
  title?: string;
}) {
  const cls =
    tone === "good"
      ? "border-neon/40 bg-neon/5 text-neon"
      : tone === "warn"
        ? "border-amber-500/40 bg-amber-500/5 text-amber-500"
        : tone === "bad"
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-border/50 bg-background/40 text-muted-foreground";
  return (
    <span
      title={title ?? label}
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${cls}`}
    >
      <Icon className="h-3 w-3" />
      <span className="opacity-70">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </span>
  );
}

export function SupportCustomerContext({
  userId,
  email,
  onOpenFicha,
}: {
  userId: string;
  email?: string | null;
  onOpenFicha: () => void;
}) {
  const load = useServerFn(adminCustomer360);
  const [data, setData] = useState<any>(() => ctxCache.get(userId) ?? null);
  const [loading, setLoading] = useState(!ctxCache.has(userId));
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  const fetchData = async (force = false) => {
    if (!force && ctxCache.has(userId)) {
      setData(ctxCache.get(userId));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r: any = await load({ data: { userId } });
      ctxCache.set(userId, r);
      setData(r);
    } catch (e: any) {
      setError(e?.message || "falha ao carregar contexto");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setData(ctxCache.get(userId) ?? null);
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const licenses: any[] = data?.licenses ?? [];
  const activeLicenses = licenses.filter(
    (l) => !l.revoked && !l.disabled_at && (!l.expires_at || new Date(l.expires_at) > new Date()),
  );
  const nextExpiry = activeLicenses
    .map((l) => l.expires_at)
    .filter(Boolean)
    .sort()[0] as string | undefined;
  const openRefunds = (data?.refunds ?? []).filter(
    (r: any) => r.status === "pending" || r.status === "approved",
  ).length;
  const hasTrialOnly = licenses.length > 0 && activeLicenses.every((l) => l.is_trial);

  const summaryText = data
    ? [
        `Cliente: ${data.profile?.display_name || data.profile?.full_name || "—"} <${data.profile?.email ?? email ?? "—"}>`,
        `Desde: ${dt(data.summary?.firstSeen)} · Pedidos pagos: ${data.summary?.paidOrdersCount ?? 0}/${data.summary?.ordersCount ?? 0} · Gasto: ${brl(data.summary?.totalSpent ?? 0)}`,
        `Licenças ativas: ${activeLicenses.length}${nextExpiry ? ` (próxima vence ${dt(nextExpiry)})` : ""}`,
        activeLicenses
          .map((l) => `  - ${l.yaarsa_email} · ${l.plan_slug} · ${l.panel} · vence ${dt(l.expires_at)}`)
          .join("\n"),
        `Cashback: ${brl(data.summary?.cashbackBalance ?? 0)} · Tickets abertos: ${data.summary?.openThreads ?? 0} · Reembolsos em aberto: ${openRefunds}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return (
    <div className="border-b border-border/40 bg-background/20 px-3 py-2 md:px-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          contexto do cliente
        </button>

        {open && (
          <>
            {loading && !data && (
              <span className="font-mono text-[10px] text-muted-foreground">carregando ficha...</span>
            )}
            {error && !data && (
              <span className="font-mono text-[10px] text-destructive">{error}</span>
            )}
            {data && (
              <>
                <Chip
                  icon={ShieldCheck}
                  label="licenças"
                  value={String(activeLicenses.length)}
                  tone={activeLicenses.length > 0 ? "good" : "warn"}
                  title={
                    activeLicenses.length
                      ? activeLicenses
                          .map((l) => `${l.yaarsa_email} · ${l.plan_slug} · vence ${dt(l.expires_at)}`)
                          .join("\n")
                      : "Sem licença ativa"
                  }
                />
                {nextExpiry && (
                  <Chip
                    icon={ShieldCheck}
                    label="vence"
                    value={dt(nextExpiry)}
                    tone={
                      new Date(nextExpiry).getTime() - Date.now() < 3 * 86400000 ? "warn" : "muted"
                    }
                  />
                )}
                <Chip
                  icon={ShoppingBag}
                  label="pagos"
                  value={String(data.summary?.paidOrdersCount ?? 0)}
                  tone={(data.summary?.paidOrdersCount ?? 0) > 0 ? "good" : "muted"}
                />
                <Chip icon={Wallet} label="gasto" value={brl(data.summary?.totalSpent ?? 0)} />
                {(data.summary?.cashbackBalance ?? 0) > 0 && (
                  <Chip icon={Wallet} label="cashback" value={brl(data.summary.cashbackBalance)} />
                )}
                {openRefunds > 0 && (
                  <Chip
                    icon={AlertTriangle}
                    label="reembolso"
                    value={String(openRefunds)}
                    tone="bad"
                  />
                )}
                {hasTrialOnly && activeLicenses.length > 0 && (
                  <Chip icon={AlertTriangle} label="somente" value="trial" tone="warn" />
                )}
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  cliente desde {dt(data.summary?.firstSeen)}
                </span>
              </>
            )}

            <div className="ml-auto flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenFicha}
                className="h-6 gap-1 px-2 font-mono text-[9px] uppercase"
              >
                <IdCard className="h-3 w-3" /> ficha
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!data}
                onClick={() => {
                  navigator.clipboard.writeText(summaryText);
                  toast.success("Resumo copiado para repasse");
                }}
                className="h-6 gap-1 px-2 font-mono text-[9px] uppercase"
              >
                <Copy className="h-3 w-3" /> resumo
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void fetchData(true)}
                className="h-6 gap-1 px-2 font-mono text-[9px] uppercase"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
