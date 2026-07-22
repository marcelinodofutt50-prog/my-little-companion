import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bitcoin, Copy, ExternalLink, ShieldAlert, ShieldCheck, Wallet, CheckCircle2, Loader2, Upload, X, Clock } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { detectAddress, networkLabel, type ChainId } from "@/lib/crypto-address";
import { submitCryptoPayment, listMyCryptoPayments } from "@/lib/crypto-payments.functions";
import { supabase } from "@/integrations/supabase/client";

type NetId = "bitcoin" | "ethereum" | "tron" | "bsc";
type CoinId = "BTC" | "ETH" | "USDT";

type Wallet = {
  id: string;
  coin: CoinId;
  netId: NetId;
  network: string;
  expectedChain: ChainId;
  address: string;
  uri: string;
  accent: string;
  warning: { pt: string; en: string };
};

const WALLETS: Wallet[] = [
  {
    id: "btc",
    coin: "BTC",
    netId: "bitcoin",
    network: "Bitcoin (mainnet)",
    expectedChain: "bitcoin",
    address: "bc1qlwyf3lhw9sz7q0n9x5kyrp826va3wtgumtrt4w",
    uri: "bitcoin:bc1qlwyf3lhw9sz7q0n9x5kyrp826va3wtgumtrt4w",
    accent: "text-[#f7931a]",
    warning: {
      pt: "Envie apenas Bitcoin (BTC) na rede nativa. Não use Lightning nem redes wrapped.",
      en: "Send only Bitcoin (BTC) on the native chain. Do not use Lightning or wrapped networks.",
    },
  },
  {
    id: "eth",
    coin: "ETH",
    netId: "ethereum",
    network: "Ethereum (ERC-20)",
    expectedChain: "ethereum",
    address: "0xb1fD336ec3227048ee2Fb4A293fD43eDAf7190C0",
    uri: "ethereum:0xb1fD336ec3227048ee2Fb4A293fD43eDAf7190C0",
    accent: "text-[#627eea]",
    warning: {
      pt: "Envie apenas ETH na rede Ethereum. Não envie da Arbitrum/Optimism/Base sem confirmar antes.",
      en: "Send only ETH on the Ethereum mainnet. Do not send from Arbitrum/Optimism/Base without confirming first.",
    },
  },
  {
    id: "usdt-erc20",
    coin: "USDT",
    netId: "ethereum",
    network: "Tether USD — Ethereum (ERC-20)",
    expectedChain: "ethereum",
    address: "0xb1fD336ec3227048ee2Fb4A293fD43eDAf7190C0",
    uri: "ethereum:0xb1fD336ec3227048ee2Fb4A293fD43eDAf7190C0",
    accent: "text-[#26a17b]",
    warning: {
      pt: "Envie apenas USDT (ERC-20) na rede Ethereum. Taxas mais altas, mas máxima compatibilidade.",
      en: "Send only USDT (ERC-20) on Ethereum. Higher fees, but maximum compatibility.",
    },
  },
  {
    id: "usdt-trc20",
    coin: "USDT",
    netId: "tron",
    network: "Tether USD — Tron (TRC-20)",
    expectedChain: "tron",
    address: "TVoSTYfgeTUpccvKJPmr9F9DdsMCDf4u5V",
    uri: "tron:TVoSTYfgeTUpccvKJPmr9F9DdsMCDf4u5V",
    accent: "text-[#ef0027]",
    warning: {
      pt: "Envie apenas USDT (TRC-20) na rede Tron. Rede mais barata — recomendada para pagamentos rápidos.",
      en: "Send only USDT (TRC-20) on Tron. Cheapest network — recommended for fast payments.",
    },
  },
  {
    id: "usdt-bep20",
    coin: "USDT",
    netId: "bsc",
    network: "Tether USD — BNB Smart Chain (BEP-20)",
    expectedChain: "bsc",
    address: "0xb1fD336ec3227048ee2Fb4A293fD43eDAf7190C0",
    uri: "0xb1fD336ec3227048ee2Fb4A293fD43eDAf7190C0",
    accent: "text-[#f0b90b]",
    warning: {
      pt: "Envie apenas USDT (BEP-20) na BNB Smart Chain. Não confunda com BEP-2 (Beacon Chain).",
      en: "Send only USDT (BEP-20) on BNB Smart Chain. Do not confuse with BEP-2 (Beacon Chain).",
    },
  },
];

export const Route = createFileRoute("/crypto")({
  head: () => ({
    meta: [
      { title: "Shadow — Crypto Payment (BTC, ETH, USDT)" },
      { name: "description", content: "Pay Shadow licenses with Bitcoin, Ethereum or USDT (ERC-20, TRC-20, BEP-20). International customers welcome." },
      { property: "og:title", content: "Shadow — Crypto Payment" },
      { property: "og:description", content: "BTC, ETH and USDT (ERC-20 / TRC-20 / BEP-20). International customers welcome." },
    ],
  }),
  component: CryptoPage,
});

function qrUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=1&data=${encodeURIComponent(data)}`;
}

function short(addr: string) {
  return addr.length > 22 ? `${addr.slice(0, 10)}…${addr.slice(-8)}` : addr;
}

function CryptoPage() {
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);

  // Automatic address ↔ network validation. Runs once at render (deterministic).
  const validated = useMemo(
    () => WALLETS.map((w) => ({ wallet: w, check: detectAddress(w.address, w.expectedChain) })),
    []
  );
  const mismatches = validated.filter((v) => !v.check.matchesExpected);

  async function copy(addr: string, id: string) {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(id);
      toast.success(t("crypto.copied"));
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{t("crypto.kicker")}</div>
        <h1 className="mt-2 font-display text-4xl leading-tight tracking-tight md:text-5xl">{t("crypto.title")}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">{t("crypto.subtitle")}</p>

        {/* How to */}
        <section className="mt-8 grid gap-4 rounded-none border border-border bg-card/40 p-6 md:grid-cols-3">
          <div className="md:col-span-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-foreground">
            <Wallet className="h-4 w-4" /> {t("crypto.howto.title")}
          </div>
          {[t("crypto.howto.1"), t("crypto.howto.2"), t("crypto.howto.3")].map((step, i) => (
            <div key={i} className="rounded-none border border-border/60 bg-background p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">step {i + 1}</div>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{step}</p>
            </div>
          ))}
          <div className="md:col-span-3">
            <Link to="/suporte">
              <Button size="sm" className="rounded-none font-mono text-[10px] uppercase tracking-[0.2em]">
                {t("crypto.openSupport")} <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Warning banner */}
        <div className="mt-6 flex items-start gap-3 rounded-none border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="text-sm leading-relaxed">
            <strong className="font-semibold">{t("crypto.warn.network")}</strong>{" "}
            <span className="text-amber-100/80">
              {lang === "pt"
                ? "Confirme sempre a rede da sua carteira antes de enviar. Um USDT enviado como ERC-20 para um endereço TRC-20 (ou vice-versa) é irrecuperável."
                : "Always confirm the network on your wallet before sending. USDT sent as ERC-20 to a TRC-20 address (or vice versa) is unrecoverable."}
            </span>
          </div>
        </div>

        {/* Global validation banner — surfaces if any hardcoded address ever
            stops matching its declared network (deploy safety net). */}
        {mismatches.length > 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-none border border-red-500/50 bg-red-500/10 p-4 text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div className="text-sm leading-relaxed">
              <strong className="font-semibold">
                {lang === "pt" ? "Endereço inconsistente detectado." : "Inconsistent address detected."}
              </strong>{" "}
              <span className="text-red-100/80">
                {lang === "pt"
                  ? "Não realize pagamento até que a equipe confirme. Envie mensagem no suporte."
                  : "Do not send funds until support confirms. Contact us on the support chat."}
              </span>
            </div>
          </div>
        )}

        {/* Wallet cards */}
        <section className="mt-8 grid gap-6 md:grid-cols-2">
          {validated.map(({ wallet: w, check }) => {
            const verified = check.matchesExpected;
            const badgeLabel = networkLabel(w.expectedChain);
            return (
            <article key={w.id} className="rounded-none border border-border bg-card/40 p-6">
              <header className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bitcoin className={`h-5 w-5 ${w.accent}`} />
                  <div>
                    <div className="font-display text-lg leading-tight">{w.coin}</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {t("crypto.network")}: {w.network}
                    </div>
                  </div>
                </div>
                {verified ? (
                  <span
                    title={lang === "pt" ? "Endereço validado para esta rede" : "Address validated for this network"}
                    className="inline-flex shrink-0 items-center gap-1 rounded-none border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-300"
                  >
                    <ShieldCheck className="h-3 w-3" /> {badgeLabel.short} ✓
                  </span>
                ) : (
                  <span
                    title={check.reason ?? ""}
                    className="inline-flex shrink-0 items-center gap-1 rounded-none border border-red-500/60 bg-red-500/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-red-300"
                  >
                    <AlertTriangle className="h-3 w-3" /> {lang === "pt" ? "não validado" : "unverified"}
                  </span>
                )}
              </header>

              <div className="mt-5 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div className="rounded-md border border-border bg-white p-2">
                  <img src={qrUrl(w.uri)} alt={`${w.coin} ${w.network} QR`} width={200} height={200} loading="lazy" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t("crypto.address")}</div>
                    {verified && (
                      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-400/80">
                        {lang === "pt" ? "rede confirmada" : "network confirmed"}: {badgeLabel.full}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 break-all font-mono text-xs text-foreground sm:hidden">{short(w.address)}</div>
                  <div className="mt-1 hidden break-all font-mono text-xs text-foreground sm:block">{w.address}</div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copy(w.address, w.id)}
                    disabled={!verified}
                    className="mt-3 rounded-none font-mono text-[10px] uppercase tracking-[0.2em]"
                  >
                    {copied === w.id ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                    {copied === w.id ? t("crypto.copied") : t("crypto.copy")}
                  </Button>
                  <div className="mt-3 rounded-none border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-amber-100/90">
                    <span className="font-mono uppercase tracking-[0.2em] text-amber-300">{t("crypto.sendOnly")}: {w.coin} · {badgeLabel.short}</span>
                    <div className="mt-1">{w.warning[lang]}</div>
                  </div>
                </div>
              </div>
            </article>
            );
          })}
        </section>

        <CryptoSubmitSection />
      </main>
    </div>
  );
}

// =====================================================================
// Submission form + live status tracker
// =====================================================================

type PlanChoice = { slug: "login-7d" | "login-30d" | "login-lifetime"; label: string; priceBrl: number };
const PLAN_CHOICES: PlanChoice[] = [
  { slug: "login-7d", label: "Semanal — 7 dias", priceBrl: 450 },
  { slug: "login-30d", label: "Mensal — 30 dias", priceBrl: 750 },
  { slug: "login-lifetime", label: "Vitalício", priceBrl: 1700 },
];

const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

const HASH_RE: Record<NetId, RegExp> = {
  bitcoin: /^[a-f0-9]{64}$/i,
  tron: /^[a-f0-9]{64}$/i,
  ethereum: /^0x[a-f0-9]{64}$/i,
  bsc: /^0x[a-f0-9]{64}$/i,
};

type MyPayment = {
  id: string;
  plan_slug: string;
  network: string;
  coin: string;
  tx_hash: string;
  status: "pending" | "verifying" | "confirmed" | "fulfilled" | "failed" | "rejected";
  confirmations: number;
  required_confirmations: number;
  failure_reason: string | null;
  created_at: string;
};

function CryptoSubmitSection() {
  const { lang } = useI18n();
  const [authed, setAuthed] = useState<boolean>(false);
  const [walletId, setWalletId] = useState<string>(WALLETS[0].id);
  const [planSlug, setPlanSlug] = useState<PlanChoice["slug"]>("login-30d");
  const [txHash, setTxHash] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [proofErr, setProofErr] = useState<string | null>(null);
  const [hashErr, setHashErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<MyPayment[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = useServerFn(submitCryptoPayment);
  const list = useServerFn(listMyCryptoPayments);

  const wallet = WALLETS.find((w) => w.id === walletId)!;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(Boolean(data.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(Boolean(s?.user)));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function refresh() {
    if (!authed) return;
    try {
      const r = await list();
      setItems((r?.payments ?? []) as MyPayment[]);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!authed) return;
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  function validateHash(v: string): string | null {
    const trimmed = v.trim();
    if (!trimmed) return lang === "pt" ? "Cole o hash da transação." : "Paste the transaction hash.";
    const re = HASH_RE[wallet.netId];
    if (!re.test(trimmed)) {
      if (wallet.netId === "ethereum" || wallet.netId === "bsc") {
        return lang === "pt" ? "Hash EVM inválido: precisa começar com 0x e ter 64 hex." : "Invalid EVM hash: needs 0x + 64 hex.";
      }
      return lang === "pt" ? "Hash inválido: 64 caracteres hexadecimais." : "Invalid hash: 64 hex characters.";
    }
    return null;
  }

  function pickFile(f: File | null) {
    setProofErr(null);
    if (!f) { setProof(null); return; }
    if (!ACCEPTED_MIME.includes(f.type as any)) {
      setProofErr(lang === "pt" ? "Formato não aceito. Use PNG, JPG ou WEBP." : "Unsupported format. Use PNG, JPG or WEBP.");
      return;
    }
    if (f.size > MAX_PROOF_BYTES) {
      setProofErr(lang === "pt" ? "Arquivo maior que 5MB." : "File larger than 5MB.");
      return;
    }
    setProof(f);
  }

  async function fileToBase64(file: File): Promise<string> {
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.byteLength; i++) bin += String.fromCharCode(buf[i]);
    return btoa(bin);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authed) {
      toast.error(lang === "pt" ? "Entre na sua conta para enviar comprovantes." : "Sign in to submit receipts.");
      return;
    }
    const err = validateHash(txHash);
    setHashErr(err);
    if (err) return;
    if (proofErr) return;
    setSubmitting(true);
    try {
      const proofBase64 = proof ? await fileToBase64(proof) : undefined;
      const proofMime = proof ? (proof.type as "image/png" | "image/jpeg" | "image/webp") : undefined;
      await submit({
        data: {
          planSlug,
          network: wallet.netId,
          coin: wallet.coin,
          txHash: txHash.trim(),
          proofBase64,
          proofMime,
        },
      });
      toast.success(lang === "pt" ? "Comprovante enviado! Verificando na blockchain..." : "Receipt submitted! Verifying on-chain...");
      setTxHash(""); setProof(null); if (inputRef.current) inputRef.current.value = "";
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? (lang === "pt" ? "Falha ao enviar." : "Submission failed."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      {/* ---- Form ---- */}
      <form onSubmit={onSubmit} className="rounded-none border border-border bg-card/50 p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          {lang === "pt" ? "verificação automática" : "auto-verification"}
        </div>
        <h2 className="mt-1 font-display text-2xl leading-tight">
          {lang === "pt" ? "Pagou? Envie o comprovante." : "Sent? Submit your receipt."}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {lang === "pt"
            ? "Nossa IA verifica o hash na blockchain. Após 6 confirmações, o login é gerado e enviado automaticamente no seu Dashboard."
            : "Our AI verifies the hash on-chain. After 6 confirmations, the login is auto-generated and delivered to your Dashboard."}
        </p>

        {!authed && (
          <div className="mt-4 rounded-none border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            {lang === "pt" ? "Entre na sua conta para enviar. " : "Sign in to submit. "}
            <Link to="/auth" className="underline underline-offset-2">/auth</Link>
          </div>
        )}

        <div className="mt-5 grid gap-4">
          {/* Plan */}
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {lang === "pt" ? "Plano" : "Plan"}
            </label>
            <select
              value={planSlug}
              onChange={(e) => setPlanSlug(e.target.value as PlanChoice["slug"])}
              className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {PLAN_CHOICES.map((p) => (
                <option key={p.slug} value={p.slug}>{p.label} — R$ {p.priceBrl.toLocaleString("pt-BR")}</option>
              ))}
            </select>
          </div>

          {/* Wallet */}
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {lang === "pt" ? "Moeda / Rede" : "Coin / Network"}
            </label>
            <select
              value={walletId}
              onChange={(e) => { setWalletId(e.target.value); setHashErr(null); }}
              className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {WALLETS.map((w) => (
                <option key={w.id} value={w.id}>{w.coin} — {w.network}</option>
              ))}
            </select>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              {lang === "pt" ? "Destino:" : "Destination:"} <span className="text-foreground">{short(wallet.address)}</span>
            </div>
          </div>

          {/* Hash */}
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {lang === "pt" ? "Hash da transação" : "Transaction hash"}
            </label>
            <input
              value={txHash}
              onChange={(e) => { setTxHash(e.target.value); setHashErr(null); }}
              onBlur={() => setHashErr(validateHash(txHash))}
              placeholder={wallet.netId === "ethereum" || wallet.netId === "bsc" ? "0x..." : "abc123..."}
              className={`w-full rounded-none border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary ${hashErr ? "border-red-500/70" : "border-border"}`}
            />
            {hashErr && <div className="mt-1 flex items-center gap-1 text-xs text-red-400"><AlertTriangle className="h-3 w-3" /> {hashErr}</div>}
          </div>

          {/* File */}
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {lang === "pt" ? "Comprovante (PNG · JPG · WEBP · até 5MB)" : "Receipt (PNG · JPG · WEBP · up to 5MB)"}
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="hidden"
                id="crypto-proof-input"
              />
              <label
                htmlFor="crypto-proof-input"
                className="inline-flex cursor-pointer items-center gap-2 rounded-none border border-border bg-background px-3 py-2 text-xs font-mono uppercase tracking-[0.2em] hover:border-primary"
              >
                <Upload className="h-3.5 w-3.5" /> {lang === "pt" ? "Anexar" : "Attach"}
              </label>
              {proof && (
                <div className="flex flex-1 items-center justify-between rounded-none border border-border bg-background px-3 py-2 text-xs">
                  <span className="truncate">{proof.name} · {(proof.size / 1024).toFixed(0)}KB</span>
                  <button type="button" onClick={() => { setProof(null); if (inputRef.current) inputRef.current.value = ""; }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            {proofErr && <div className="mt-1 flex items-center gap-1 text-xs text-red-400"><AlertTriangle className="h-3 w-3" /> {proofErr}</div>}
            <div className="mt-1 text-[11px] text-muted-foreground">
              {lang === "pt" ? "Opcional — mas ajuda o suporte se houver algum problema." : "Optional — but helps support if anything goes wrong."}
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting || !authed}
            className="rounded-none font-mono text-[10px] uppercase tracking-[0.2em]"
          >
            {submitting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            {lang === "pt" ? "Enviar e verificar" : "Submit & verify"}
          </Button>
        </div>
      </form>

      {/* ---- Status ---- */}
      <div className="rounded-none border border-border bg-card/40 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              {lang === "pt" ? "seus envios" : "your submissions"}
            </div>
            <h3 className="mt-1 font-display text-xl">{lang === "pt" ? "Verificação em tempo real" : "Live verification"}</h3>
          </div>
          <Button size="sm" variant="outline" onClick={refresh} className="rounded-none font-mono text-[10px] uppercase tracking-[0.2em]">
            {lang === "pt" ? "Atualizar" : "Refresh"}
          </Button>
        </div>

        {!authed && (
          <div className="mt-4 text-sm text-muted-foreground">
            {lang === "pt" ? "Entre para ver seus envios." : "Sign in to see your submissions."}
          </div>
        )}
        {authed && items.length === 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            {lang === "pt" ? "Nenhum envio ainda." : "No submissions yet."}
          </div>
        )}
        <ul className="mt-4 space-y-3">
          {items.map((p) => <PaymentRow key={p.id} p={p} lang={lang} />)}
        </ul>

        <Link to="/suporte" className="mt-6 inline-flex">
          <Button size="sm" variant="outline" className="rounded-none font-mono text-[10px] uppercase tracking-[0.2em]">
            {lang === "pt" ? "Falar com suporte" : "Contact support"} <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

function PaymentRow({ p, lang }: { p: MyPayment; lang: "pt" | "en" }) {
  const pct = Math.min(100, Math.round((p.confirmations / (p.required_confirmations || 6)) * 100));
  const badge = (() => {
    switch (p.status) {
      case "fulfilled": return { text: lang === "pt" ? "Login entregue" : "Login delivered", cls: "text-emerald-300 border-emerald-500/50 bg-emerald-500/10" };
      case "confirmed": return { text: lang === "pt" ? "Confirmado — gerando login" : "Confirmed — issuing login", cls: "text-emerald-300 border-emerald-500/50 bg-emerald-500/10" };
      case "verifying": return { text: lang === "pt" ? "Aguardando confirmações" : "Awaiting confirmations", cls: "text-amber-200 border-amber-500/50 bg-amber-500/10" };
      case "pending": return { text: lang === "pt" ? "Buscando na blockchain" : "Scanning blockchain", cls: "text-blue-200 border-blue-500/50 bg-blue-500/10" };
      case "rejected": return { text: lang === "pt" ? "Rejeitado" : "Rejected", cls: "text-red-300 border-red-500/50 bg-red-500/10" };
      case "failed": return { text: lang === "pt" ? "Falha — contate suporte" : "Failed — contact support", cls: "text-red-300 border-red-500/50 bg-red-500/10" };
    }
  })();
  return (
    <li className="rounded-none border border-border/70 bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {p.coin} · {p.network} · {p.plan_slug}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-foreground">{p.tx_hash}</div>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 rounded-none border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] ${badge.cls}`}>
          {p.status === "verifying" || p.status === "pending" ? <Clock className="h-3 w-3" /> : p.status === "fulfilled" || p.status === "confirmed" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {badge.text}
        </span>
      </div>
      {(p.status === "verifying" || p.status === "confirmed" || p.status === "fulfilled") && (
        <div className="mt-2">
          <div className="h-1 w-full overflow-hidden bg-border">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
            {p.confirmations}/{p.required_confirmations} {lang === "pt" ? "confirmações" : "confirmations"}
          </div>
        </div>
      )}
      {p.failure_reason && <div className="mt-2 text-[11px] text-red-300/90">{p.failure_reason}</div>}
    </li>
  );
}
