import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminCustomer360 } from "@/lib/admin.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Copy,
  ShieldCheck,
  Wallet,
  Ticket,
  KeySquare,
  RefreshCw,
  AlertTriangle,
  Info,
  Star,
  Repeat,
  Gift,
  Smartphone,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

const brl = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");
const d = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");

function Stat({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: any;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 font-mono text-lg tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
        {typeof count === "number" && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            {count}
          </Badge>
        )}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

const empty = <p className="text-xs text-muted-foreground">Nada por aqui.</p>;

function CopyLine({ value, label }: { value?: string | null; label: string }) {
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        toast.success(`${label} copiado`);
      }}
      className="inline-flex max-w-full items-center gap-1 truncate rounded px-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
      title={`Copiar ${label}`}
    >
      <Copy className="h-3 w-3 shrink-0" /> <span className="truncate">{value}</span>
    </button>
  );
}

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
    if (!userId) {
      setData(null);
      return;
    }
    fetchData(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Copiado");
  };

  const isActive = (l: any) =>
    !l.revoked && !l.disabled_at && (!l.expires_at || new Date(l.expires_at) > new Date());

  const fullReport = useMemo(() => {
    if (!data) return "";
    const s = data.summary ?? {};
    return [
      `FICHA DO CLIENTE`,
      `Nome: ${data.profile?.display_name || data.profile?.full_name || "—"}`,
      `E-mail: ${data.profile?.email ?? "—"}`,
      `Cliente desde: ${d(s.firstSeen)} · Risco: ${s.riskLevel} · Confiança: ${s.trustScore ?? "—"}`,
      `Financeiro: ${brl(s.totalSpent)} em ${s.paidOrdersCount}/${s.ordersCount} pedido(s) · ticket médio ${brl(s.ticketMedio)} · cashback ${brl(s.cashbackBalance)}`,
      s.subscriptionStatus
        ? `Assinatura: ${s.subscriptionPlan} (${s.subscriptionStatus}) renova ${d(s.subscriptionRenewsAt)}`
        : `Assinatura: nenhuma ativa`,
      `Licenças ativas: ${s.activeLicensesCount}/${s.licensesCount}${s.nextExpiry ? ` · próxima vence ${d(s.nextExpiry)}` : ""}`,
      ...(data.licenses ?? [])
        .filter(isActive)
        .map((l: any) => `  - ${l.yaarsa_email} · ${l.plan_slug} · ${l.panel} · vence ${d(l.expires_at)}${l.is_trial ? " · trial" : ""}`),
      `Fidelidade: ${s.loyaltyPoints} ponto(s) · tier ${s.vipTier ?? "—"} · indicações válidas ${s.referralsValid}`,
      `Suporte: ${s.openThreads} ticket(s) aberto(s) · reembolsos pendentes ${s.pendingRefunds}`,
      (data.alerts ?? []).length ? `Alertas:` : "",
      ...(data.alerts ?? []).map((a: any) => `  ! ${a.text}`),
    ]
      .filter(Boolean)
      .join("\n");
  }, [data]);

  const s = data?.summary ?? {};

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
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : data ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {(data.roles ?? []).map((r: string) => (
                <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="text-[10px] uppercase">
                  {r}
                </Badge>
              ))}
              {s.vipTier && (
                <Badge variant="outline" className="gap-1 text-[10px] uppercase">
                  <Star className="h-3 w-3" /> {s.vipTier}
                </Badge>
              )}
              <Badge
                variant="outline"
                className={`text-[10px] uppercase ${
                  s.riskLevel === "alto"
                    ? "border-destructive/50 text-destructive"
                    : s.riskLevel === "médio"
                      ? "border-amber-500/50 text-amber-500"
                      : "border-border/60 text-muted-foreground"
                }`}
              >
                risco {s.riskLevel}
              </Badge>
              <div className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[11px]" onClick={() => copy(data.profile?.email ?? "")}>
                  <Copy className="h-3 w-3" /> e-mail
                </Button>
                <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-[11px]" onClick={() => copy(fullReport)}>
                  <Copy className="h-3 w-3" /> ficha
                </Button>
                <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[11px]" onClick={() => userId && fetchData(userId)}>
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {(data.alerts ?? []).length > 0 && (
              <div className="space-y-1">
                {data.alerts.map((a: any, i: number) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-lg border p-2 text-[11px] ${
                      a.level === "bad"
                        ? "border-destructive/40 bg-destructive/5 text-destructive"
                        : a.level === "warn"
                          ? "border-amber-500/40 bg-amber-500/5 text-amber-500"
                          : "border-border/60 bg-card/40 text-muted-foreground"
                    }`}
                  >
                    {a.level === "info" ? (
                      <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    )}
                    <span>{a.text}</span>
                  </div>
                ))}
              </div>
            )}

            <Tabs defaultValue="resumo">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="resumo" className="text-[11px]">Resumo</TabsTrigger>
                <TabsTrigger value="licencas" className="text-[11px]">Licenças</TabsTrigger>
                <TabsTrigger value="financeiro" className="text-[11px]">Financeiro</TabsTrigger>
                <TabsTrigger value="suporte" className="text-[11px]">Suporte</TabsTrigger>
              </TabsList>

              <TabsContent value="resumo" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Gasto total" value={brl(s.totalSpent)} icon={Wallet} hint={`ticket médio ${brl(s.ticketMedio)}`} />
                  <Stat label="Cashback" value={brl(s.cashbackBalance)} icon={Wallet} />
                  <Stat
                    label="Licenças ativas"
                    value={`${s.activeLicensesCount}/${s.licensesCount}`}
                    icon={ShieldCheck}
                    hint={s.nextExpiry ? `vence ${d(s.nextExpiry)}` : undefined}
                  />
                  <Stat label="Tickets abertos" value={String(s.openThreads)} icon={Ticket} />
                  <Stat label="Pontos" value={String(s.loyaltyPoints)} icon={Star} hint={s.vipTier ?? undefined} />
                  <Stat
                    label="Assinatura"
                    value={s.subscriptionStatus ?? "—"}
                    icon={Repeat}
                    hint={s.subscriptionRenewsAt ? `renova ${d(s.subscriptionRenewsAt)}` : undefined}
                  />
                  <Stat label="Play Protect" value={String(s.activePlayProtectCount ?? 0)} icon={Smartphone} />
                  <Stat label="Indicações" value={String(s.referralsValid ?? 0)} icon={KeySquare} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Cliente desde {dt(s.firstSeen)} · {s.paidOrdersCount} pedido(s) pago(s) de {s.ordersCount}
                  {s.lastOrderAt ? ` · último pedido ${d(s.lastOrderAt)} (${s.lastOrderStatus})` : ""}
                </p>

                <Section title="Identificação">
                  <div className="space-y-1 rounded-lg border border-border/60 bg-card/40 p-2">
                    <CopyLine value={data.profile?.email} label="E-mail" />
                    <CopyLine value={userId} label="ID do usuário" />
                    <CopyLine value={data.profile?.referral_code} label="Código de indicação" />
                    <p className="text-[10px] text-muted-foreground">
                      Confiança: {s.trustScore ?? "—"} · Reputação: {data.profile?.reputation_score ?? "—"}
                    </p>
                  </div>
                </Section>

                <Section title="Antifraude / testes" count={(data.fraud ?? []).length}>
                  {(data.fraud ?? []).length === 0 && (data.trials ?? []).length === 0
                    ? empty
                    : (
                      <>
                        {(data.fraud ?? []).map((f: any) => (
                          <div key={f.id} className="rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono">{f.decision ?? "—"} · score {f.score ?? "?"}</span>
                              <span className="text-[10px] text-muted-foreground">{d(f.created_at)}</span>
                            </div>
                            {Array.isArray(f.reasons) && f.reasons.length > 0 && (
                              <div className="mt-0.5 text-[10px] text-muted-foreground">{f.reasons.join(", ")}</div>
                            )}
                          </div>
                        ))}
                        {(data.trials ?? []).map((t: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 p-2 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" /> teste usado em {dt(t.used_at)}
                          </div>
                        ))}
                      </>
                    )}
                </Section>
              </TabsContent>

              <TabsContent value="licencas" className="mt-4 space-y-4">
                <Section title="Licenças" count={data.licenses.length}>
                  {data.licenses.length === 0
                    ? empty
                    : data.licenses.map((l: any) => {
                        const active = isActive(l);
                        const days = l.expires_at
                          ? Math.floor((new Date(l.expires_at).getTime() - Date.now()) / 86400000)
                          : null;
                        return (
                          <div key={l.id} className="rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <CopyLine value={l.yaarsa_email} label="Login do painel" />
                              <Badge variant={active ? "default" : "secondary"} className="shrink-0 text-[10px]">
                                {active ? "ativa" : l.revoked ? "revogada" : "expirada"}
                              </Badge>
                            </div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {l.plan_slug} · {l.panel} · vence {d(l.expires_at)}
                              {active && days !== null ? ` (${days}d)` : ""}
                              {l.is_trial ? " · trial" : ""}
                            </div>
                            {l.password_sync_status && (
                              <div className="mt-0.5 text-[10px] text-muted-foreground">
                                senha: {l.password_sync_status}
                                {l.password_synced_at ? ` em ${d(l.password_synced_at)}` : ""}
                              </div>
                            )}
                          </div>
                        );
                      })}
                </Section>

                <Section title="Play Protect" count={data.playProtect?.length ?? data.apkJobs.length}>
                  {(data.playProtect ?? []).length === 0 && data.apkJobs.length === 0
                    ? empty
                    : (
                      <>
                        {(data.playProtect ?? []).map((g: any) => (
                          <div key={g.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
                            <span className="text-[11px] text-muted-foreground">{g.source ?? "acesso"}</span>
                            <span className="font-mono text-[11px]">até {d(g.expires_at)}</span>
                          </div>
                        ))}
                        {data.apkJobs.map((j: any) => (
                          <div key={j.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
                            <span className="min-w-0 flex-1 truncate font-mono">{j.source_filename}</span>
                            <Badge variant="secondary" className="text-[10px]">{j.status}</Badge>
                          </div>
                        ))}
                      </>
                    )}
                </Section>

                <Section title="Códigos resgatados" count={data.redeemUses?.length ?? 0}>
                  {(data.redeemUses ?? []).length === 0
                    ? empty
                    : data.redeemUses.map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
                          <span className="flex items-center gap-1.5 font-mono"><Gift className="h-3 w-3" /> {r.code}</span>
                          <span className="text-[10px] text-muted-foreground">{d(r.created_at)}</span>
                        </div>
                      ))}
                </Section>
              </TabsContent>

              <TabsContent value="financeiro" className="mt-4 space-y-4">
                <Section title="Assinaturas" count={data.subscriptions?.length ?? 0}>
                  {(data.subscriptions ?? []).length === 0
                    ? empty
                    : data.subscriptions.map((sub: any) => (
                        <div key={sub.id} className="rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono">{sub.plan_slug}</span>
                            <Badge variant={sub.status === "active" ? "default" : "secondary"} className="text-[10px]">
                              {sub.status}
                            </Badge>
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            renova {d(sub.current_period_end)}
                            {sub.cancel_at_period_end ? " · cancela no fim do período" : ""}
                            {sub.environment ? ` · ${sub.environment}` : ""}
                          </div>
                        </div>
                      ))}
                </Section>

                <Section title="Pedidos" count={data.orders.length}>
                  {data.orders.length === 0
                    ? empty
                    : data.orders.slice(0, 15).map((o: any) => (
                        <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
                          <div className="min-w-0">
                            <div className="truncate font-mono">{o.plan_slug}</div>
                            <div className="text-[11px] text-muted-foreground">{dt(o.created_at)}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-mono tabular-nums">{brl(o.amount)}</div>
                            <Badge variant={o.status === "paid" ? "default" : "secondary"} className="text-[10px]">
                              {o.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                </Section>

                <Section title="Reembolsos" count={data.refunds.length}>
                  {data.refunds.length === 0
                    ? empty
                    : data.refunds.map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
                          <span className="min-w-0 flex-1 truncate">{r.reason}</span>
                          <span className="font-mono tabular-nums">{brl(r.amount)}</span>
                          <Badge variant="secondary" className="text-[10px]">{r.status}</Badge>
                        </div>
                      ))}
                </Section>

                <Section title="Indicações" count={data.referrals.length}>
                  {data.referrals.length === 0
                    ? empty
                    : data.referrals.map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
                          <span className="flex items-center gap-1.5"><KeySquare className="h-3 w-3" /> {d(r.created_at)}</span>
                          <span className="font-mono tabular-nums">{brl(r.reward_amount)}</span>
                          <Badge variant="secondary" className="text-[10px]">{r.reward_status}</Badge>
                        </div>
                      ))}
                </Section>
              </TabsContent>

              <TabsContent value="suporte" className="mt-4 space-y-4">
                <Section title="Tickets" count={data.threads.length}>
                  {data.threads.length === 0
                    ? empty
                    : data.threads.map((t: any) => (
                        <button
                          key={t.id}
                          onClick={() => onOpenThread?.(t.id)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/40 p-2 text-left text-xs hover:border-primary/50"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {t.subject}
                            <span className="block text-[10px] text-muted-foreground">
                              {t.category ?? "outro"} · {d(t.updated_at)}
                            </span>
                          </span>
                          {t.unread_by_staff > 0 && (
                            <span className="rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground">
                              {t.unread_by_staff}
                            </span>
                          )}
                          <Badge variant="secondary" className="text-[10px]">{t.status}</Badge>
                        </button>
                      ))}
                </Section>

                <Section title="Fidelidade">
                  <div className="rounded-lg border border-border/60 bg-card/40 p-2 text-[11px] text-muted-foreground">
                    {s.loyaltyPoints} ponto(s) · tier {s.vipTier ?? "—"}
                    {data.loyalty?.days_active ? ` · ${data.loyalty.days_active} dia(s) ativo(s)` : ""}
                    {data.loyalty?.last_action_at ? ` · última ação ${d(data.loyalty.last_action_at)}` : ""}
                  </div>
                </Section>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
