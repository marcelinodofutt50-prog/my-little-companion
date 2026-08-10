import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminCustomer360 } from "@/lib/admin.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Copy, ShieldCheck, Wallet, Ticket, KeySquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const brl = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 font-mono text-lg tabular-nums">{value}</div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
        {typeof count === "number" && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{count}</Badge>}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

const empty = <p className="text-xs text-muted-foreground">Nada por aqui.</p>;

export function AdminCustomer360({
  userId,
  onClose,
  onOpenThread,
}: {
  userId: string | null;
  onClose: () => void;
  onOpenThread?: (threadId: string) => void;
}) {
  const load = useServerFn(adminCustomer360);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async (uid: string) => {
    setLoading(true);
    try {
      setData(await load({ data: { userId: uid } }));
    } catch (e: any) {
      toast.error("Falha ao carregar ficha", { description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) { setData(null); return; }
    fetchData(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copiado"); };

  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-mono text-base">
            {data?.profile?.display_name || data?.profile?.full_name || "Ficha do cliente"}
          </SheetTitle>
          <SheetDescription className="break-all font-mono text-xs">
            {data?.profile?.email ?? userId}
          </SheetDescription>
        </SheetHeader>

        {loading && !data ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : data ? (
          <div className="mt-4 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {(data.roles ?? []).map((r: string) => (
                <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="text-[10px] uppercase">{r}</Badge>
              ))}
              <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[11px]" onClick={() => copy(data.profile?.email ?? "")}>
                <Copy className="h-3 w-3" /> e-mail
              </Button>
              <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[11px]" onClick={() => userId && fetchData(userId)}>
                <RefreshCw className="h-3 w-3" /> atualizar
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Gasto total" value={brl(data.summary.totalSpent)} icon={Wallet} />
              <Stat label="Cashback" value={brl(data.summary.cashbackBalance)} icon={Wallet} />
              <Stat label="Licenças ativas" value={String(data.summary.activeLicensesCount)} icon={ShieldCheck} />
              <Stat label="Tickets abertos" value={String(data.summary.openThreads)} icon={Ticket} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cliente desde {dt(data.summary.firstSeen)} · {data.summary.paidOrdersCount} pedido(s) pago(s) de {data.summary.ordersCount}
            </p>

            <Section title="Licenças" count={data.licenses.length}>
              {data.licenses.length === 0 ? empty : data.licenses.map((l: any) => {
                const active = !l.revoked && !l.disabled_at && (!l.expires_at || new Date(l.expires_at) > new Date());
                return (
                  <div key={l.id} className="rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono">{l.yaarsa_email}</span>
                      <Badge variant={active ? "default" : "secondary"} className="text-[10px]">
                        {active ? "ativa" : l.revoked ? "revogada" : "expirada"}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {l.plan_slug} · {l.panel} · vence {dt(l.expires_at)}{l.is_trial ? " · trial" : ""}
                    </div>
                  </div>
                );
              })}
            </Section>

            <Section title="Pedidos" count={data.orders.length}>
              {data.orders.length === 0 ? empty : data.orders.slice(0, 10).map((o: any) => (
                <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
                  <div className="min-w-0">
                    <div className="truncate font-mono">{o.plan_slug}</div>
                    <div className="text-[11px] text-muted-foreground">{dt(o.created_at)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono tabular-nums">{brl(o.amount)}</div>
                    <Badge variant={o.status === "paid" ? "default" : "secondary"} className="text-[10px]">{o.status}</Badge>
                  </div>
                </div>
              ))}
            </Section>

            <Section title="Tickets" count={data.threads.length}>
              {data.threads.length === 0 ? empty : data.threads.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => onOpenThread?.(t.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/40 p-2 text-left text-xs hover:border-primary/50"
                >
                  <span className="min-w-0 flex-1 truncate">{t.subject}</span>
                  {t.unread_by_staff > 0 && (
                    <span className="rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground">{t.unread_by_staff}</span>
                  )}
                  <Badge variant="secondary" className="text-[10px]">{t.status}</Badge>
                </button>
              ))}
            </Section>

            <Section title="Reembolsos" count={data.refunds.length}>
              {data.refunds.length === 0 ? empty : data.refunds.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">{r.reason}</span>
                  <span className="font-mono tabular-nums">{brl(r.amount)}</span>
                  <Badge variant="secondary" className="text-[10px]">{r.status}</Badge>
                </div>
              ))}
            </Section>

            <Section title="Play Protect" count={data.apkJobs.length}>
              {data.apkJobs.length === 0 ? empty : data.apkJobs.map((j: any) => (
                <div key={j.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
                  <span className="min-w-0 flex-1 truncate font-mono">{j.source_filename}</span>
                  <Badge variant="secondary" className="text-[10px]">{j.status}</Badge>
                </div>
              ))}
            </Section>

            <Section title="Indicações" count={data.referrals.length}>
              {data.referrals.length === 0 ? empty : data.referrals.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
                  <span className="flex items-center gap-1.5"><KeySquare className="h-3 w-3" /> {dt(r.created_at)}</span>
                  <span className="font-mono tabular-nums">{brl(r.reward_amount)}</span>
                  <Badge variant="secondary" className="text-[10px]">{r.reward_status}</Badge>
                </div>
              ))}
            </Section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
