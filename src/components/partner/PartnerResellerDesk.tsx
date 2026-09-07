import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  Copy,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  Wallet,
} from "lucide-react";
import {
  getPartnerDesk,
  partnerCancelLicense,
  partnerCreateCustomer,
  partnerCreateLicense,
  partnerRegisterPayment,
  partnerRevealLicense,
  partnerSyncLicense,
} from "@/lib/partner-reseller.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const PLANS = [
  { slug: "login-7d", label: "7 dias" },
  { slug: "login-30d", label: "30 dias" },
  { slug: "login-lifetime", label: "Vitalício" },
] as const;

const STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: "Ativa", tone: "bg-primary/20 text-primary" },
  pending_sync: { label: "Aguardando painel", tone: "bg-amber-500/20 text-amber-400" },
  cancelled: { label: "Cancelada", tone: "bg-muted text-muted-foreground" },
  expired: { label: "Vencida", tone: "bg-destructive/20 text-destructive" },
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmt(v: string | null) {
  return v ? new Date(v).toLocaleDateString("pt-BR") : "—";
}

export function PartnerResellerDesk() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["partner-desk"], queryFn: () => getPartnerDesk({}) });

  const createCustomer = useServerFn(partnerCreateCustomer);
  const createLicense = useServerFn(partnerCreateLicense);
  const registerPayment = useServerFn(partnerRegisterPayment);
  const syncLicense = useServerFn(partnerSyncLicense);
  const revealLicense = useServerFn(partnerRevealLicense);
  const cancelLicense = useServerFn(partnerCancelLicense);

  const [tab, setTab] = useState<"clientes" | "licencas" | "historico">("clientes");
  const [busy, setBusy] = useState<string | null>(null);

  const [cName, setCName] = useState("");
  const [cContact, setCContact] = useState("");
  const [cNotes, setCNotes] = useState("");

  const [lCustomer, setLCustomer] = useState("");
  const [lPlan, setLPlan] = useState<(typeof PLANS)[number]["slug"]>("login-30d");
  const [lPrice, setLPrice] = useState("50");

  const [payFor, setPayFor] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("50");
  const [payMethod, setPayMethod] = useState<"pix" | "dinheiro" | "cartao" | "outro">("pix");
  const [payNote, setPayNote] = useState("");
  const [shown, setShown] = useState<Record<string, { email: string; username: string; password: string }>>({});

  const customers = data?.customers ?? [];
  const licenses = data?.licenses ?? [];
  const payments = data?.payments ?? [];
  const summary = data?.summary;

  const customerName = useMemo(() => {
    const m = new Map<string, string>();
    customers.forEach((c: any) => m.set(c.id, c.name));
    return m;
  }, [customers]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["partner-desk"] });

  async function run<T>(key: string, fn: () => Promise<any>, okMsg?: string) {
    setBusy(key);
    try {
      const res = await fn();
      if (res?.error) {
        toast.error(res.error);
        return null;
      }
      if (res?.warning) toast.warning(res.warning);
      else if (okMsg) toast.success(okMsg);
      refresh();
      return res as T;
    } catch (e) {
      toast.error((e as Error)?.message ?? "Não foi possível concluir agora.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function onCreateCustomer() {
    if (cName.trim().length < 2) return toast.error("Escreva o nome do cliente.");
    const res = await run("customer", () =>
      createCustomer({ data: { name: cName.trim(), contact: cContact.trim() || null, notes: cNotes.trim() || null } }),
      "Cliente cadastrado.",
    );
    if (res) {
      setCName("");
      setCContact("");
      setCNotes("");
    }
  }

  async function onCreateLicense() {
    if (!lCustomer) return toast.error("Escolha o cliente.");
    const price = Math.round(parseFloat(lPrice.replace(",", ".") || "0") * 100);
    const res: any = await run(
      "license",
      () => createLicense({ data: { customerId: lCustomer, planSlug: lPlan, priceCents: price } }),
      "Licença criada e enviada ao painel.",
    );
    if (res?.login) {
      setShown((s) => ({ ...s, [res.licenseId]: res.login }));
      setTab("licencas");
    }
  }

  async function onPay(licenseId: string) {
    const amount = Math.round(parseFloat(payAmount.replace(",", ".") || "0") * 100);
    const res = await run(
      `pay-${licenseId}`,
      () => registerPayment({ data: { licenseId, amountCents: amount, method: payMethod, note: payNote || null, renew: true } }),
      "Pagamento registrado e validade renovada.",
    );
    if (res) {
      setPayFor(null);
      setPayNote("");
    }
  }

  async function onReveal(licenseId: string) {
    const res: any = await run(`reveal-${licenseId}`, () => revealLicense({ data: { licenseId } }));
    if (res?.login) setShown((s) => ({ ...s, [licenseId]: res.login }));
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando sua revenda...
      </div>
    );
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">Sua revenda</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre clientes, gere os logins no painel, receba o pagamento e acompanhe o histórico.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Clientes", value: String(summary?.customers ?? 0) },
          { label: "Licenças ativas", value: String(summary?.activeLicenses ?? 0) },
          { label: "Aguardando painel", value: String(summary?.pendingSync ?? 0) },
          { label: "Recebido", value: brl(summary?.revenueCents ?? 0) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/50 bg-card/40 p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
            <div className="mt-1 font-display text-xl">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["clientes", "licencas", "historico"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs capitalize",
              tab === t ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground",
            )}
          >
            {t === "licencas" ? "licenças" : t === "historico" ? "histórico" : t}
          </button>
        ))}
      </div>

      {tab === "clientes" ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
            <h3 className="flex items-center gap-2 font-display text-base">
              <UserPlus className="h-4 w-4 text-primary" /> Novo cliente
            </h3>
            <div className="mt-3 space-y-3">
              <Input placeholder="Nome do cliente" value={cName} onChange={(e) => setCName(e.target.value)} />
              <Input placeholder="WhatsApp ou e-mail" value={cContact} onChange={(e) => setCContact(e.target.value)} />
              <Textarea placeholder="Observações (opcional)" rows={3} value={cNotes} onChange={(e) => setCNotes(e.target.value)} />
              <Button className="w-full" onClick={onCreateCustomer} disabled={busy === "customer"}>
                {busy === "customer" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Cadastrar
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
            <h3 className="font-display text-base">Meus clientes</h3>
            {customers.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/40">
                {customers.map((c: any) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.contact || "sem contato"}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {licenses.filter((l: any) => l.customer_id === c.id).length} licença(s)
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {tab === "licencas" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
            <h3 className="flex items-center gap-2 font-display text-base">
              <BadgeCheck className="h-4 w-4 text-primary" /> Criar licença
            </h3>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <select
                className="h-10 rounded-md border border-border/50 bg-background px-3 text-sm"
                value={lCustomer}
                onChange={(e) => setLCustomer(e.target.value)}
              >
                <option value="">Escolha o cliente</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border border-border/50 bg-background px-3 text-sm"
                value={lPlan}
                onChange={(e) => setLPlan(e.target.value as any)}
              >
                {PLANS.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.label}
                  </option>
                ))}
              </select>
              <Input placeholder="Preço cobrado (R$)" value={lPrice} onChange={(e) => setLPrice(e.target.value)} />
              <Button onClick={onCreateLicense} disabled={busy === "license"}>
                {busy === "license" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Gerar login
              </Button>
            </div>
          </div>

          {licenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma licença criada ainda.</p>
          ) : (
            <div className="space-y-3">
              {licenses.map((l: any) => {
                const st = STATUS[l.status] ?? { label: l.status, tone: "bg-muted text-muted-foreground" };
                const login = shown[l.id];
                return (
                  <div key={l.id} className="rounded-2xl border border-border/50 bg-card/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{customerName.get(l.customer_id) ?? "Cliente removido"}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.panel_email} · vence {fmt(l.expires_at)} · {brl(l.price_cents ?? 0)}
                        </div>
                      </div>
                      <span className={cn("rounded-full px-2 py-0.5 font-mono text-[10px] uppercase", st.tone)}>{st.label}</span>
                    </div>

                    {l.sync_error ? (
                      <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
                        {l.sync_error}
                      </p>
                    ) : null}

                    {login ? (
                      <div className="mt-3 rounded-lg border border-primary/20 bg-background/50 p-3 font-mono text-xs">
                        <div>e-mail: {login.email}</div>
                        <div>usuário: {login.username}</div>
                        <div>senha: {login.password}</div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2 h-7 px-2 text-[11px]"
                          onClick={() => {
                            void navigator.clipboard.writeText(
                              `E-mail: ${login.email}\nUsuário: ${login.username}\nSenha: ${login.password}`,
                            );
                            toast.success("Login copiado.");
                          }}
                        >
                          <Copy className="mr-1 h-3 w-3" /> Copiar
                        </Button>
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => onReveal(l.id)} disabled={busy === `reveal-${l.id}`}>
                        <Eye className="mr-1 h-3.5 w-3.5" /> Ver login
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => run(`sync-${l.id}`, () => syncLicense({ data: { licenseId: l.id } }), "Sincronizado com o painel.")}
                        disabled={busy === `sync-${l.id}`}
                      >
                        {busy === `sync-${l.id}` ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1 h-3.5 w-3.5" />
                        )}
                        Sincronizar
                      </Button>
                      <Button size="sm" onClick={() => setPayFor(payFor === l.id ? null : l.id)}>
                        <Wallet className="mr-1 h-3.5 w-3.5" /> Registrar pagamento
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => run(`cancel-${l.id}`, () => cancelLicense({ data: { licenseId: l.id } }), "Licença cancelada.")}
                        disabled={busy === `cancel-${l.id}`}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Cancelar
                      </Button>
                    </div>

                    {payFor === l.id ? (
                      <div className="mt-3 grid gap-2 rounded-lg border border-border/50 bg-background/40 p-3 md:grid-cols-4">
                        <Input placeholder="Valor (R$)" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                        <select
                          className="h-10 rounded-md border border-border/50 bg-background px-3 text-sm"
                          value={payMethod}
                          onChange={(e) => setPayMethod(e.target.value as any)}
                        >
                          <option value="pix">Pix</option>
                          <option value="dinheiro">Dinheiro</option>
                          <option value="cartao">Cartão</option>
                          <option value="outro">Outro</option>
                        </select>
                        <Input placeholder="Observação" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
                        <Button onClick={() => onPay(l.id)} disabled={busy === `pay-${l.id}`}>
                          {busy === `pay-${l.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Confirmar
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {tab === "historico" ? (
        <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
          <h3 className="font-display text-base">Histórico de pagamentos</h3>
          {payments.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border/40">
              {payments.map((p: any) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <div className="font-medium">{customerName.get(p.customer_id) ?? "Cliente"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.paid_at).toLocaleString("pt-BR")} · {p.method}
                      {p.note ? ` · ${p.note}` : ""}
                    </div>
                  </div>
                  <div className="font-mono text-primary">{brl(p.amount_cents ?? 0)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
