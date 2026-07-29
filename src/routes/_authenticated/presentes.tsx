import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Gift, Loader2, Download, Copy, Check, ArrowUpRight, ArrowDownLeft,
  CheckCircle2, Clock, XCircle, ShoppingBag,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { listMyGifts, type GiftRecord } from "@/lib/gifts.functions";
import { formatBrl } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/presentes")({
  head: () => ({
    meta: [
      { title: "Meus presentes — Shadow" },
      { name: "description", content: "Histórico completo dos acessos que você presenteou e recebeu, com status, datas e comprovantes de pagamento." },
      { property: "og:title", content: "Meus presentes — Shadow" },
      { property: "og:description", content: "Acompanhe presentes enviados e recebidos, status da entrega e comprovantes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GiftsPage,
});

type Data = Awaited<ReturnType<typeof listMyGifts>>;

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

function statusInfo(status: string) {
  if (status === "paid") return { label: "Entregue", cls: "text-primary border-primary/40 bg-primary/10", Icon: CheckCircle2 };
  if (status === "pending" || status === "processing")
    return { label: "Aguardando pagamento", cls: "text-amber-400 border-amber-400/40 bg-amber-400/10", Icon: Clock };
  if (status === "refunded") return { label: "Reembolsado", cls: "text-sky-400 border-sky-400/40 bg-sky-400/10", Icon: ArrowDownLeft };
  return { label: "Cancelado/expirado", cls: "text-muted-foreground border-border bg-muted/30", Icon: XCircle };
}

function GiftsPage() {
  const fn = useServerFn(listMyGifts);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"received" | "sent">("received");

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await fn()); }
    catch (e: any) { toast.error(e?.message ?? "Não foi possível carregar seus presentes."); }
    finally { setLoading(false); }
  }, [fn]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (data && data.received.length === 0 && data.sent.length > 0) setTab("sent");
  }, [data]);

  const list = useMemo(() => (tab === "sent" ? data?.sent ?? [] : data?.received ?? []), [tab, data]);
  const totalSpent = useMemo(
    () => (data?.sent ?? []).filter((g) => g.status === "paid").reduce((a, g) => a + g.amount, 0),
    [data],
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
        <div className="osint-panel osint-corners osint-sweep relative flex flex-wrap items-end justify-between gap-4 overflow-hidden p-5" style={{ ["--osint-sweep-h" as any]: "120px" }}>
          <div>
            <div className="osint-label flex items-center gap-2 text-primary">
              <Gift className="h-3.5 w-3.5" /> presentes
            </div>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Histórico de presentes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tudo que você presenteou e tudo que recebeu — com status, datas e comprovante.
            </p>
          </div>
          <Link to="/planos">
            <Button size="sm" className="gap-2"><ShoppingBag className="h-4 w-4" /> Presentear alguém</Button>
          </Link>
        </div>

        {/* Resumo */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Recebidos" value={String(data?.received.length ?? 0)} />
          <StatCard label="Enviados" value={String(data?.sent.length ?? 0)} />
          <StatCard label="Total presenteado" value={formatBrl(totalSpent)} className="col-span-2 sm:col-span-1" />
        </div>

        {/* Abas */}
        <div className="mt-6 inline-flex rounded-lg border border-border bg-card/40 p-1">
          {(["received", "sent"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 text-sm transition ${
                tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "received" ? "Recebidos" : "Enviados"}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card/40 py-14 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
            </div>
          )}

          {!loading && list.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card/30 px-6 py-14 text-center">
              <Gift className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm text-muted-foreground">
                {tab === "received"
                  ? "Você ainda não recebeu nenhum presente. Quando alguém te presentear, o acesso aparece aqui na hora."
                  : "Você ainda não presenteou ninguém. É simples: escolha o plano, marque “Presentear alguém” e informe o e-mail da pessoa."}
              </p>
              <Link to="/planos" className="mt-4 inline-block">
                <Button variant="outline" size="sm">Ver planos</Button>
              </Link>
            </div>
          )}

          {!loading && list.map((g) => <GiftCard key={g.order_id} gift={g} kind={tab} />)}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card/40 px-4 py-3 ${className}`}>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function GiftCard({ gift, kind }: { gift: GiftRecord; kind: "sent" | "received" }) {
  const s = statusInfo(gift.status);
  const [copied, setCopied] = useState(false);

  const receipt = useMemo(
    () =>
      [
        "COMPROVANTE DE PAGAMENTO — SHADOW",
        "----------------------------------",
        `Pedido:        ${gift.order_id}`,
        `Produto:       ${gift.plan_name}`,
        `Valor:         ${formatBrl(gift.amount)}`,
        `Status:        ${statusInfo(gift.status).label}`,
        `Criado em:     ${fmtDate(gift.created_at)}`,
        `Pago em:       ${fmtDate(gift.paid_at)}`,
        `Pagamento MP:  ${gift.mp_payment_id ?? "—"}`,
        `Preferência:   ${gift.mp_preference_id ?? "—"}`,
        kind === "sent" ? `Presenteado:   ${gift.counterpart_email ?? "—"}` : `Enviado por:   ${gift.counterpart_email ?? "—"}`,
        gift.message ? `Mensagem:      "${gift.message}"` : "",
        "----------------------------------",
        "Pagamento processado via Mercado Pago (PIX).",
      ].filter(Boolean).join("\n"),
    [gift, kind],
  );

  function download() {
    const blob = new Blob([receipt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comprovante-${gift.order_id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Comprovante baixado");
  }

  async function copy() {
    await navigator.clipboard.writeText(receipt);
    setCopied(true);
    toast.success("Comprovante copiado");
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4 transition hover:border-primary/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {kind === "sent"
              ? <ArrowUpRight className="h-4 w-4 shrink-0 text-primary" />
              : <ArrowDownLeft className="h-4 w-4 shrink-0 text-primary" />}
            <span className="truncate font-semibold">{gift.plan_name}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {kind === "sent" ? "Para " : "De "}
            <b className="text-foreground">{gift.counterpart_email ?? "—"}</b>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg text-primary">{formatBrl(gift.amount)}</div>
          <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${s.cls}`}>
            <s.Icon className="h-3 w-3" /> {s.label}
          </span>
        </div>
      </div>

      {gift.message && (
        <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm italic text-foreground/90">
          “{gift.message}”
        </p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <Field label="Compra" value={fmtDate(gift.created_at)} />
        <Field label="Pagamento" value={fmtDate(gift.paid_at)} />
        <Field label="Pedido" value={gift.order_id.slice(0, 8)} mono />
        <Field label="Validade do acesso" value={gift.license?.expires_at ? fmtDate(gift.license.expires_at) : gift.status === "paid" ? "Vitalício / sem prazo" : "—"} />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-2" onClick={download}>
          <Download className="h-3.5 w-3.5" /> Baixar comprovante
        </Button>
        <Button size="sm" variant="ghost" className="gap-2" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copiar dados
        </Button>
        {kind === "received" && gift.status === "paid" && (
          <Link to="/dashboard">
            <Button size="sm" variant="ghost" className="gap-2">Ver meus acessos</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
