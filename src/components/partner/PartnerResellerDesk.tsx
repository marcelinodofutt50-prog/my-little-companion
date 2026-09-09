import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarPlus,
  Copy,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserPlus,
  Wallet,
} from "lucide-react";
import {
  getPartnerDesk,
  partnerCancelLicense,
  partnerCreateCustomer,
  partnerCreateLicense,
  partnerExtendLicense,
  partnerRegisterPayment,
  partnerRevealLicense,
  partnerSyncLicense,
} from "@/lib/partner-reseller.functions";
import { buildCredentialMessage, daysLeft, resolveLicenseDays } from "@/lib/partner-reseller-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const PLANS = [
  { slug: "login-7d", label: "7 dias" },
  { slug: "login-30d", label: "30 dias" },
  { slug: "login-lifetime", label: "Vitalício" },
] as const;

type PlanSlug = (typeof PLANS)[number]["slug"];

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
function parseMoney(v: string) {
  return Math.max(0, Math.round(parseFloat(v.replace(/\./g, "").replace(",", ".") || "0") * 100));
}
function copy(text: string, okMsg: string) {
  void navigator.clipboard.writeText(text);
  toast.success(okMsg);
}

type Issued = {
  licenseId: string;
  synced: boolean;
  warning: string | null;
  login: { email: string; username: string; password: string };
  message: string;
};

export function PartnerResellerDesk() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["partner-desk"], queryFn: () => getPartnerDesk() });

  const createCustomer = useServerFn(partnerCreateCustomer);
  const createLicense = useServerFn(partnerCreateLicense);
  const registerPayment = useServerFn(partnerRegisterPayment);
  const extendLicense = useServerFn(partnerExtendLicense);
  const syncLicense = useServerFn(partnerSyncLicense);
  const revealLicense = useServerFn(partnerRevealLicense);
  const cancelLicense = useServerFn(partnerCancelLicense);

  const [tab, setTab] = useState<"emitir" | "licencas" | "clientes" | "historico">("emitir");
  const [busy, setBusy] = useState<string | null>(null);

  // ---- emissão de licença ----
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [lCustomer, setLCustomer] = useState("");
  const [nName, setNName] = useState("");
  const [nContact, setNContact] = useState("");
  const [lPlan, setLPlan] = useState<PlanSlug>("login-30d");
  const [customDays, setCustomDays] = useState("");
  const [lPrice, setLPrice] = useState("50,00");
  const [lQty, setLQty] = useState("1");
  const [lNote, setLNote] = useState("");
  const [issued, setIssued] = useState<{ customerName: string; expiresAt: string | null; items: Issued[] } | null>(null);

  // ---- cadastro avulso de cliente ----
  const [cName, setCName] = useState("");
  const [cContact, setCContact] = useState("");
  const [cNotes, setCNotes] = useState("");

  // ---- licenças ----
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todas" | "active" | "pending_sync" | "cancelled">("todas");
  const [payFor, setPayFor] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("50,00");
  const [payMethod, setPayMethod] = useState<"pix" | "dinheiro" | "cartao" | "outro">("pix");
  const [payNote, setPayNote] = useState("");
  const [extendFor, setExtendFor] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState("30");
  const [shown, setShown] = useState<Record<string, { email: string; username: string; password: string }>>({});

  const customers = data?.customers ?? [];
  const licenses = data?.licenses ?? [];
  const payments = data?.payments ?? [];
  const summary = data?.summary;

  const customerById = useMemo(() => {
    const m = new Map<string, any>();
    customers.forEach((c: any) => m.set(c.id, c));
    return m;
  }, [customers]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return licenses.filter((l: any) => {
      if (statusFilter !== "todas" && l.status !== statusFilter) return false;
      if (!term) return true;
      const name = (customerById.get(l.customer_id)?.name ?? "").toLowerCase();
      return (
        name.includes(term) ||
        String(l.panel_email ?? "").toLowerCase().includes(term) ||
        String(l.panel_username ?? "").toLowerCase().includes(term)
      );
    });
  }, [licenses, q, statusFilter, customerById]);

  const previewDays = resolveLicenseDays(lPlan, customDays ? Number(customDays) : null);

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
    const res = await run(
      "customer",
      () => createCustomer({ data: { name: cName.trim(), contact: cContact.trim() || null, notes: cNotes.trim() || null } }),
      "Cliente cadastrado.",
    );
    if (res) {
      setCName("");
      setCContact("");
      setCNotes("");
    }
  }

  async function onIssue() {
    if (mode === "existing" && !lCustomer) return toast.error("Escolha o cliente.");
    if (mode === "new" && nName.trim().length < 2) return toast.error("Escreva o nome do novo cliente.");
    const quantity = Math.min(10, Math.max(1, parseInt(lQty || "1", 10) || 1));

    const res: any = await run(
      "issue",
      () =>
        createLicense({
          data: {
            customerId: mode === "existing" ? lCustomer : null,
            newCustomer: mode === "new" ? { name: nName.trim(), contact: nContact.trim() || null } : null,
            planSlug: lPlan,
            days: customDays ? Math.max(1, parseInt(customDays, 10) || 0) : null,
            priceCents: parseMoney(lPrice),
            quantity,
            note: lNote.trim() || null,
          },
        }),
      quantity > 1 ? `${quantity} licenças emitidas.` : "Licença emitida e login criado no painel.",
    );

    if (res?.created?.length) {
      setIssued({ customerName: res.customerName ?? "", expiresAt: res.expiresAt ?? null, items: res.created });
      setNName("");
      setNContact("");
      setLNote("");
      setLQty("1");
      if (mode === "new" && res.customerId) {
        setMode("existing");
        setLCustomer(res.customerId);
      }
    }
  }

  async function onPay(licenseId: string) {
    const res = await run(
      `pay-${licenseId}`,
      () =>
        registerPayment({
          data: { licenseId, amountCents: parseMoney(payAmount), method: payMethod, note: payNote || null, renew: true },
        }),
      "Pagamento registrado e validade renovada.",
    );
    if (res) {
      setPayFor(null);
      setPayNote("");
    }
  }

  async function onExtend(licenseId: string) {
    const days = Math.max(1, parseInt(extendDays || "0", 10) || 0);
    if (!days) return toast.error("Informe quantos dias adicionar.");
    const res = await run(`ext-${licenseId}`, () => extendLicense({ data: { licenseId, days } }), `+${days} dia(s) aplicados.`);
    if (res) setExtendFor(null);
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

  const TABS = [
    { key: "emitir", label: "Emitir licença" },
    { key: "licencas", label: `Licenças (${licenses.length})` },
    { key: "clientes", label: `Clientes (${customers.length})` },
    { key: "historico", label: "Histórico" },
  ] as const;

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">Sua revenda</h2>
          <p className="text-sm text-muted-foreground">
            Emita os logins na hora, cobre do seu cliente e acompanhe vencimentos — tudo por aqui.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Clientes", value: String(summary?.customers ?? 0) },
          { label: "Licenças ativas", value: String(summary?.activeLicenses ?? 0) },
          { label: "Vencem em 5 dias", value: String((summary as any)?.expiringSoon ?? 0) },
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
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              tab === t.key ? "border-primary bg-primary/15 text-primary" : "border-border/50 text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ------------------------------ EMITIR ------------------------------ */}
      {tab === "emitir" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
            <h3 className="flex items-center gap-2 font-display text-base">
              <BadgeCheck className="h-4 w-4 text-primary" /> Emitir licença
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              O login é criado direto no painel e já sai pronto para enviar ao seu cliente.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  1. Para quem é
                </div>
                <div className="flex gap-2">
                  {(
                    [
                      { key: "new", label: "Novo cliente" },
                      { key: "existing", label: "Cliente já cadastrado" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMode(m.key)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs",
                        mode === m.key ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {mode === "new" ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Input placeholder="Nome do cliente" value={nName} onChange={(e) => setNName(e.target.value)} />
                    <Input placeholder="WhatsApp ou e-mail (opcional)" value={nContact} onChange={(e) => setNContact(e.target.value)} />
                  </div>
                ) : (
                  <select
                    className="mt-3 h-10 w-full rounded-md border border-border/50 bg-background px-3 text-sm"
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
                )}
              </div>

              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  2. Plano e prazo
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    className="h-10 rounded-md border border-border/50 bg-background px-3 text-sm"
                    value={lPlan}
                    onChange={(e) => setLPlan(e.target.value as PlanSlug)}
                  >
                    {PLANS.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Dias personalizados"
                    inputMode="numeric"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                  <Input
                    placeholder="Quantidade (1–10)"
                    inputMode="numeric"
                    value={lQty}
                    onChange={(e) => setLQty(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Validade: <span className="text-foreground">{previewDays} dia(s)</span> a partir de hoje.
                </p>
              </div>

              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  3. Quanto você cobrou
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input placeholder="Preço por licença (R$)" value={lPrice} onChange={(e) => setLPrice(e.target.value)} />
                  <Input placeholder="Observação interna (opcional)" value={lNote} onChange={(e) => setLNote(e.target.value)} />
                </div>
              </div>

              <Button className="w-full" onClick={onIssue} disabled={busy === "issue"}>
                {busy === "issue" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Emitir e criar login no painel
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
            <h3 className="font-display text-base">Últimos logins emitidos</h3>
            {!issued ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Assim que você emitir, os dados aparecem aqui com a mensagem pronta para enviar.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {issued.items.map((it) => (
                  <div key={it.licenseId} className="rounded-xl border border-primary/20 bg-background/50 p-3">
                    <div className="font-mono text-xs leading-relaxed">
                      <div>e-mail: {it.login.email}</div>
                      <div>usuário: {it.login.username}</div>
                      <div>senha: {it.login.password}</div>
                    </div>
                    {!it.synced ? (
                      <p className="mt-2 flex items-start gap-1 text-[11px] text-amber-400">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {it.warning}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => copy(it.message, "Mensagem copiada.")}>
                        <Send className="mr-1 h-3 w-3" /> Copiar mensagem
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px]"
                        onClick={() =>
                          copy(`E-mail: ${it.login.email}\nUsuário: ${it.login.username}\nSenha: ${it.login.password}`, "Login copiado.")
                        }
                      >
                        <Copy className="mr-1 h-3 w-3" /> Só o login
                      </Button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Vence em {fmt(issued.expiresAt)}.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ------------------------------ LICENÇAS ------------------------------ */}
      {tab === "licencas" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por cliente, e-mail ou usuário" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select
              className="h-10 rounded-md border border-border/50 bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="todas">Todas</option>
              <option value="active">Ativas</option>
              <option value="pending_sync">Aguardando painel</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {licenses.length === 0 ? "Nenhuma licença criada ainda. Use a aba “Emitir licença”." : "Nada encontrado com esse filtro."}
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((l: any) => {
                const st = STATUS[l.status] ?? { label: l.status, tone: "bg-muted text-muted-foreground" };
                const login = shown[l.id];
                const left = daysLeft(l.expires_at ?? null);
                const name = customerById.get(l.customer_id)?.name ?? "Cliente removido";
                return (
                  <div key={l.id} className="rounded-2xl border border-border/50 bg-card/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.panel_email} · vence {fmt(l.expires_at)} · {brl(l.price_cents ?? 0)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {left !== null && l.status === "active" ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase",
                              left < 0
                                ? "bg-destructive/20 text-destructive"
                                : left <= 5
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {left < 0 ? `venceu há ${Math.abs(left)}d` : `${left}d restantes`}
                          </span>
                        ) : null}
                        <span className={cn("rounded-full px-2 py-0.5 font-mono text-[10px] uppercase", st.tone)}>{st.label}</span>
                      </div>
                    </div>

                    {l.sync_error ? (
                      <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">{l.sync_error}</p>
                    ) : null}

                    {login ? (
                      <div className="mt-3 rounded-lg border border-primary/20 bg-background/50 p-3 font-mono text-xs">
                        <div>e-mail: {login.email}</div>
                        <div>usuário: {login.username}</div>
                        <div>senha: {login.password}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => copy(`E-mail: ${login.email}\nUsuário: ${login.username}\nSenha: ${login.password}`, "Login copiado.")}
                          >
                            <Copy className="mr-1 h-3 w-3" /> Copiar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                            onClick={() =>
                              copy(
                                buildCredentialMessage({
                                  customerName: name,
                                  email: login.email,
                                  username: login.username,
                                  password: login.password,
                                  expiresAt: l.expires_at ?? null,
                                }),
                                "Mensagem copiada.",
                              )
                            }
                          >
                            <Send className="mr-1 h-3 w-3" /> Mensagem pronta
                          </Button>
                        </div>
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
                      <Button size="sm" variant="outline" onClick={() => setExtendFor(extendFor === l.id ? null : l.id)}>
                        <CalendarPlus className="mr-1 h-3.5 w-3.5" /> Adicionar dias
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

                    {extendFor === l.id ? (
                      <div className="mt-3 grid gap-2 rounded-lg border border-border/50 bg-background/40 p-3 sm:grid-cols-[160px_auto]">
                        <Input
                          placeholder="Dias"
                          inputMode="numeric"
                          value={extendDays}
                          onChange={(e) => setExtendDays(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        />
                        <Button onClick={() => onExtend(l.id)} disabled={busy === `ext-${l.id}`}>
                          {busy === `ext-${l.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Aplicar no painel
                        </Button>
                      </div>
                    ) : null}

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

      {/* ------------------------------ CLIENTES ------------------------------ */}
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
                {customers.map((c: any) => {
                  const mine = licenses.filter((l: any) => l.customer_id === c.id);
                  const actives = mine.filter((l: any) => l.status === "active").length;
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.contact || "sem contato"}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {mine.length} licença(s) · {actives} ativa(s)
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setMode("existing");
                            setLCustomer(c.id);
                            setTab("emitir");
                          }}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" /> Emitir
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {/* ------------------------------ HISTÓRICO ------------------------------ */}
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
                    <div className="font-medium">{customerById.get(p.customer_id)?.name ?? "Cliente"}</div>
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
