import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2, Loader2, Tag, Users, X, AlertCircle, ShieldCheck, Zap, Lock,
  HeadphonesIcon, Sparkles, Crown, Calendar, Clock, Server, Code2, ArrowUpRight,
  ChevronRight, Check, Minus,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { ConversionBoosters, LiveSalesToasts, MobileStickyCTA } from "@/components/ConversionBoosters";
import { VersionCompare } from "@/components/VersionCompare";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatBrl } from "@/lib/plans";
import { createCheckout } from "@/lib/checkout.functions";
import { validateCoupon, getMyCashbackBalance, getMyLegacyStatus } from "@/lib/license.functions";
import { validateReferralCode } from "@/lib/referrals.functions";


export const Route = createFileRoute("/planos")({
  head: () => ({ meta: [
    { title: "Planos Shadow — Licenças, servidor e código-fonte" },
    { name: "description", content: "Pagamento oficial via PIX Mercado Pago. Ativação automática em menos de 1 minuto. Cupom BTMOB40 entrega 40% de cashback no primeiro depósito." },
  ] }),
  component: PlansPage,
});

type Plan = { slug: string; name: string; description: string | null; price_brl: number; category: string; sort_order: number | null };
type Coupon = { code: string; discount_pct: number; cashback_pct: number };

const CASHBACK_MAX_PCT = 0.5;
const CODE_RE = /^[A-Z0-9_-]{2,16}$/;

function computeBreakdown(price: number, coupon: Coupon | null, cashbackBalance: number, useCash: boolean) {
  const discount = coupon ? +(price * (coupon.discount_pct / 100)).toFixed(2) : 0;
  const afterCoupon = Math.max(0, price - discount);
  const cashbackApplied = useCash ? Math.min(cashbackBalance, afterCoupon * CASHBACK_MAX_PCT) : 0;
  const final = Math.max(1, +(afterCoupon - cashbackApplied).toFixed(2));
  const cashbackEarn = coupon && coupon.cashback_pct > 0 ? +(final * (coupon.cashback_pct / 100)).toFixed(2) : 0;
  return { discount, cashbackApplied: +cashbackApplied.toFixed(2), final, cashbackEarn };
}

// ============ Plan meta: features + icons per slug family ============
type PlanMeta = {
  tagline: string;
  badge?: string;
  icon: any;
  features: string[];
  cadence?: string;
};

function metaFor(plan: Plan): PlanMeta {
  const s = plan.slug.toLowerCase();
  if (s.includes("lifetime")) return {
    tagline: "Acesso perpétuo à linha 4.6+ com atualizações inclusas.",
    badge: "Mais escolhido",
    icon: Crown,
    cadence: "pagamento único",
    features: [
      "Shadow 4.6+ com todos os módulos",
      "Bypass Play Protect ativo",
      "Atualizações grátis para sempre",
      "Suporte prioritário 24/7",
      "Fila prioritária no Play Protect Cloak",
    ],
  };
  if (s.includes("30") || s.includes("month")) return {
    tagline: "Operação mensal na versão estável 4.5.7.",
    icon: Calendar,
    cadence: "renovação em 30 dias",
    features: [
      "Shadow 4.5.7 completa",
      "Bypass Play Protect ativo",
      "Suporte via chat no painel",
      "Atualizações pagas à parte",
    ],
  };
  if (s.includes("7d") || s.includes("week") || s === "trial") return {
    tagline: "Ideal para validar a ferramenta em um ciclo curto.",
    icon: Clock,
    cadence: "7 dias de acesso",
    features: [
      "Shadow 4.5.5 (build básico)",
      "Fluxo essencial da ferramenta",
      "Suporte por chat",
    ],
  };
  if (s.includes("server")) return {
    tagline: "Servidor de sinal com renovação todo dia 20.",
    icon: Server,
    cadence: "mensal · vence dia 20",
    features: [
      "Infra dedicada monitorada",
      "Uptime 99,9% no ciclo",
      "IP fixo para sua licença",
      "Realinhamento automático da mensalidade",
    ],
  };
  if (s.includes("upgrade")) return {
    tagline: "Migração assistida de v4.5.7 para vitalício v4.6.",
    icon: ArrowUpRight,
    cadence: "cobrança única",
    features: [
      "Migração automática do login",
      "Vira Vitalício v4.6 imediatamente",
      "Mantém seu histórico e servidor",
      "Prioridade no suporte após upgrade",
    ],
  };
  if (s.includes("source") || s.includes("code")) return {
    tagline: "Código-fonte auditável, entrega assistida por engenheiro.",
    icon: Code2,
    cadence: "licença perpétua",
    features: [
      "Fontes completas e documentadas",
      "Sessão de handoff com engenheiro",
      "Chave de build inclusa",
    ],
  };
  return { tagline: plan.description ?? "", icon: Sparkles, features: [] };
}

function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [isLegacy, setIsLegacy] = useState(false);

  const [coupon, setCoupon] = useState("");
  const [couponValid, setCouponValid] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponPending, setCouponPending] = useState(false);

  const [cashbackBalance, setCashbackBalance] = useState(0);
  const [useCash, setUseCash] = useState(false);

  const [referral, setReferral] = useState("");
  const [referralValid, setReferralValid] = useState<{ name: string } | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralPending, setReferralPending] = useState(false);

  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const navigate = useNavigate();

  const checkoutFn = useServerFn(createCheckout);
  const validateFn = useServerFn(validateCoupon);
  const cashbackFn = useServerFn(getMyCashbackBalance);
  const legacyFn = useServerFn(getMyLegacyStatus);
  const validateRefFn = useServerFn(validateReferralCode);

  useEffect(() => {
    supabase.from("plans").select("*").eq("active", true).order("sort_order").then(({ data }) => setPlans((data ?? []) as Plan[]));
    supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user));
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) setReferral(ref.toUpperCase());
    }
  }, []);

  useEffect(() => {
    if (loggedIn) {
      cashbackFn().then((r) => setCashbackBalance(r.balance)).catch(() => {});
      legacyFn().then((r) => setIsLegacy(r.isLegacy)).catch(() => {});
      if (referral && !referralValid) {
        validateRefFn({ data: { code: referral } })
          .then((r) => { if (r.valid) setReferralValid({ name: r.referrerName! }); })
          .catch(() => {});
      }
    }
  }, [loggedIn, cashbackFn, legacyFn, referral, referralValid, validateRefFn]);

  async function applyCoupon() {
    if (!loggedIn) return toast.error("Faça login para aplicar cupom");
    const code = coupon.trim().toUpperCase();
    if (!code) { setCouponError("Digite um cupom"); return; }
    if (!CODE_RE.test(code)) { setCouponError("Formato inválido — use letras, números, - ou _"); return; }
    setCouponPending(true);
    setCouponError(null);
    try {
      const r = await validateFn({ data: { code } });
      if (r.coupon) {
        setCouponValid(r.coupon);
        setCoupon(r.coupon.code);
        toast.success(`Cupom ${r.coupon.code} aplicado`);
      } else {
        setCouponValid(null);
        setCouponError("Cupom inválido ou expirado");
      }
    } catch {
      setCouponError("Não foi possível validar agora. Tente novamente.");
    } finally { setCouponPending(false); }
  }

  function clearCoupon() { setCoupon(""); setCouponValid(null); setCouponError(null); }

  async function applyReferral() {
    if (!loggedIn) return toast.error("Faça login para aplicar código");
    const code = referral.trim().toUpperCase();
    if (!code) { setReferralError("Digite um código"); return; }
    if (!CODE_RE.test(code)) { setReferralError("Formato inválido"); return; }
    setReferralPending(true);
    setReferralError(null);
    try {
      const r = await validateRefFn({ data: { code } });
      if (r.valid) {
        setReferralValid({ name: r.referrerName! });
        setReferral(code);
        toast.success(`Código de ${r.referrerName} aplicado`);
      } else {
        setReferralValid(null);
        setReferralError("Código de indicação não encontrado");
      }
    } catch {
      setReferralError("Não foi possível validar agora. Tente novamente.");
    } finally { setReferralPending(false); }
  }

  function clearReferral() { setReferral(""); setReferralValid(null); setReferralError(null); }

  const buy = useCallback(async (slug: string) => {
    if (!loggedIn) { navigate({ to: "/auth", search: { next: "/planos" } as any }); return; }
    setLoadingPlan(slug);
    try {
      const r = await checkoutFn({ data: {
        planSlug: slug,
        couponCode: couponValid?.code,
        useCashback: useCash && cashbackBalance > 0,
        referralCode: referralValid ? referral : undefined,
        returnOrigin: window.location.origin,
      } });
      window.location.href = r.initPoint;
    } catch (e: any) {
      toast.error(e?.message?.includes("Plano") ? e.message : "Não foi possível iniciar o checkout. Tente novamente.");
      setLoadingPlan(null);
    }
  }, [loggedIn, navigate, checkoutFn, couponValid, useCash, cashbackBalance, referralValid, referral]);

  const { licenses, servers, sources, upgrades } = useMemo(() => {
    const serverAll = plans.filter((p) => p.category === "server");
    const serverFiltered = isLegacy
      ? serverAll.filter((p) => p.slug === "server-monthly-legacy")
      : serverAll.filter((p) => p.slug !== "server-monthly-legacy");
    return {
      licenses: plans.filter((p) => p.category === "license"),
      servers: serverFiltered,
      sources: plans.filter((p) => p.category === "source"),
      upgrades: isLegacy ? plans.filter((p) => p.category === "upgrade") : [],
    };
  }, [plans, isLegacy]);

  const anyBenefit = !!(couponValid || (useCash && cashbackBalance > 0) || referralValid);

  return (
    <div className="relative min-h-screen">
      <SiteHeader />

      {/* HERO ================================================= */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="pointer-events-none absolute inset-0 -z-0 opacity-70"
             style={{ background: "radial-gradient(ellipse 70% 55% at 50% 0%, oklch(0.28 0.09 82 / 0.28), transparent 65%)" }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px divider-glow" />
        <div className="mx-auto max-w-7xl px-4 pt-16 pb-14 md:pt-24 md:pb-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary pulse-dot" />
              Pricing · Edição 2026
            </div>
            <h1 className="mt-6 font-display text-4xl leading-[1.05] tracking-tight md:text-6xl">
              Planos <span className="italic text-primary">Shadow</span>.<br className="hidden md:block" />
              <span className="text-muted-foreground">Provisionamento instantâneo, cobrança transparente.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
              Cada plano é liberado em menos de 1 minuto após a confirmação do PIX. Sem burocracia, sem intermediário, sem cobrança escondida — sua licença aparece direto no dashboard.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Mercado Pago oficial</span>
              <span className="text-border">•</span>
              <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" /> Ativação &lt; 1 min</span>
              <span className="text-border">•</span>
              <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-primary" /> Credencial única por conta</span>
              <span className="text-border">•</span>
              <span className="inline-flex items-center gap-1.5"><HeadphonesIcon className="h-3.5 w-3.5 text-primary" /> Suporte humano 24/7</span>
            </div>
          </div>
        </div>
      </section>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-12 pb-28 md:pb-12">
        <LiveSalesToasts />
        <ConversionBoosters />

        {/* BENEFITS PANEL ==================================== */}
        {loggedIn && (
          <div className="mx-auto mb-14 max-w-3xl overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur">
            <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Painel de benefícios</span>
              </div>
              {anyBenefit && (
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                  ativo
                </span>
              )}
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-2">
              {/* Coupon */}
              <div>
                <label className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" /> Cupom promocional
                </label>
                <div className="flex gap-2">
                  <Input
                    value={coupon}
                    onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setCouponError(null); if (couponValid) setCouponValid(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") applyCoupon(); }}
                    placeholder="BTMOB40"
                    className="font-mono uppercase"
                    maxLength={16}
                    aria-invalid={!!couponError}
                    disabled={!!couponValid}
                  />
                  {couponValid ? (
                    <Button variant="outline" size="icon" onClick={clearCoupon} aria-label="Remover cupom">
                      <X className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={applyCoupon} disabled={couponPending} className="whitespace-nowrap font-mono uppercase">
                      {couponPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
                    </Button>
                  )}
                </div>
                {couponError && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive"><AlertCircle className="h-3 w-3" />{couponError}</div>
                )}
                {couponValid && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span><b className="font-mono">{couponValid.code}</b> ativo</span>
                    {couponValid.discount_pct > 0 && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono">-{couponValid.discount_pct}%</span>}
                    {couponValid.cashback_pct > 0 && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono">+{couponValid.cashback_pct}% cashback</span>}
                  </div>
                )}
              </div>

              {/* Referral */}
              <div>
                <label className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Código de indicação
                </label>
                <div className="flex gap-2">
                  <Input
                    value={referral}
                    onChange={(e) => { setReferral(e.target.value.toUpperCase()); setReferralError(null); if (referralValid) setReferralValid(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") applyReferral(); }}
                    placeholder="Opcional"
                    className="font-mono uppercase"
                    maxLength={16}
                    aria-invalid={!!referralError}
                    disabled={!!referralValid}
                  />
                  {referralValid ? (
                    <Button variant="outline" size="icon" onClick={clearReferral} aria-label="Remover código"><X className="h-4 w-4" /></Button>
                  ) : (
                    <Button variant="outline" onClick={applyReferral} disabled={referralPending} className="whitespace-nowrap font-mono uppercase">
                      {referralPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
                    </Button>
                  )}
                </div>
                {referralError && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive"><AlertCircle className="h-3 w-3" />{referralError}</div>
                )}
                {referralValid && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Indicado por <b>{referralValid.name}</b>
                  </div>
                )}
              </div>

              {/* Cashback */}
              {cashbackBalance > 0 && (
                <label className="md:col-span-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={useCash} onChange={(e) => setUseCash(e.target.checked)} className="h-4 w-4 accent-primary" />
                    <div>
                      <div className="text-sm">Usar cashback nesta compra</div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">até 50% do valor final</div>
                    </div>
                  </div>
                  <div className="font-mono text-lg text-primary">{formatBrl(cashbackBalance)}</div>
                </label>
              )}
            </div>

            <LegacyLookup />
          </div>
        )}

        <PreCheckoutFaq />

        {/* PLAN GROUPS ====================================== */}
        <PlanGroup
          title="Licenças de acesso"
          eyebrow="Escolha o ciclo que combina com sua operação"
          items={licenses}
          onBuy={buy}
          loading={loadingPlan}
          coupon={couponValid}
          cashback={cashbackBalance}
          useCash={useCash}
          featuredSlug="login-lifetime"
        />
        {upgrades.length > 0 && (
          <PlanGroup
            title="Upgrade v4.5.7 → v4.6"
            eyebrow="Exclusivo cliente antigo · migração automática"
            items={upgrades}
            onBuy={buy}
            loading={loadingPlan}
            coupon={couponValid}
            cashback={cashbackBalance}
            useCash={useCash}
          />
        )}
        <PlanGroup
          title="Servidor"
          eyebrow={isLegacy ? "Renovação legacy · R$ 250/mês · vence dia 20" : "Renovação mensal · vence todo dia 20"}
          items={servers}
          onBuy={buy}
          loading={loadingPlan}
          coupon={couponValid}
          cashback={cashbackBalance}
          useCash={useCash}
        />
        <PlanGroup
          title="Código-fonte"
          eyebrow="Auditável, com sessão de handoff"
          items={sources}
          onBuy={buy}
          loading={loadingPlan}
          coupon={couponValid}
          cashback={cashbackBalance}
          useCash={useCash}
        />

        <TierComparison />
        <VersionCompare />

        {/* METRICS BAR ================================= */}
        <section className="mt-14 grid gap-4 rounded-2xl border border-border/50 bg-card/40 p-6 md:grid-cols-4">
          <Metric value="99.9%" label="Uptime no ciclo" />
          <Metric value="< 1 min" label="Ativação após pago" />
          <Metric value="24/7" label="Suporte humano" />
          <Metric value="100%" label="Reembolso se falhar" />
        </section>

        <FaqSection />

        {/* SUPPORT FOOTER ============================== */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 rounded-2xl border border-border/50 bg-card/40 p-6 md:flex-row md:p-8">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">// suporte</div>
            <h3 className="mt-1 font-display text-xl">Ainda em dúvida antes de comprar?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Fale com a equipe: <a href="mailto:suportekremlin@gmail.com" className="text-primary hover:underline">suportekremlin@gmail.com</a>
              {" "}· resposta em minutos no horário comercial.
            </p>
          </div>
          <Link to="/suporte" className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 font-mono text-xs uppercase tracking-wider text-primary hover:bg-primary/20">
            Abrir chamado <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {!loggedIn && (
          <div className="mt-10 text-center text-sm text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">Faça login</Link> para comprar ou pegar o trial de 1 dia grátis.
          </div>
        )}
      </main>
      <MobileStickyCTA label="Escolher plano" to="/planos" />
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center md:text-left">
      <div className="font-display text-3xl text-primary">{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
    </div>
  );
}

function TierComparison() {
  const rows: { label: string; weekly: React.ReactNode; monthly: React.ReactNode; lifetime: React.ReactNode }[] = [
    { label: "Versão da ferramenta", weekly: "Shadow 4.5.5", monthly: "Shadow 4.5.7", lifetime: "Shadow 4.6+" },
    { label: "Bypass Play Protect", weekly: <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground" />, monthly: <Check className="mx-auto h-4 w-4 text-primary" />, lifetime: <Check className="mx-auto h-4 w-4 text-primary" /> },
    { label: "Recursos completos", weekly: "básico", monthly: <Check className="mx-auto h-4 w-4 text-primary" />, lifetime: <Check className="mx-auto h-4 w-4 text-primary" /> },
    { label: "Atualizações grátis", weekly: <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground" />, monthly: "pagas", lifetime: <Check className="mx-auto h-4 w-4 text-primary" /> },
    { label: "Suporte prioritário", weekly: <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground" />, monthly: <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground" />, lifetime: <Check className="mx-auto h-4 w-4 text-primary" /> },
    { label: "Duração", weekly: "7 dias", monthly: "30 dias", lifetime: "vitalícia" },
  ];
  return (
    <section className="mt-16">
      <div className="mb-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">// comparativo</div>
        <h2 className="mt-2 font-display text-2xl md:text-3xl">O que cada plano libera</h2>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/40">
        <div className="grid grid-cols-4 border-b border-border/50 bg-background/40 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <div className="px-4 py-3.5">Recurso</div>
          <div className="px-2 py-3.5 text-center md:px-4">Semanal</div>
          <div className="px-2 py-3.5 text-center md:px-4">Mensal</div>
          <div className="px-2 py-3.5 text-center text-primary md:px-4">Vitalício</div>
        </div>
        {rows.map((r, i) => (
          <div key={r.label} className={`grid grid-cols-4 text-xs md:text-sm ${i % 2 ? "bg-background/20" : ""}`}>
            <div className="px-4 py-3 text-muted-foreground">{r.label}</div>
            <div className="px-2 py-3 text-center font-mono md:px-4">{r.weekly}</div>
            <div className="px-2 py-3 text-center font-mono md:px-4">{r.monthly}</div>
            <div className="px-2 py-3 text-center font-mono text-foreground md:px-4">{r.lifetime}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FaqSection() {
  const faq = [
    { q: "Como recebo minha licença?", a: "Após o pagamento aprovado, o sistema cria automaticamente o login no painel e libera os dados (usuário, senha, IP do servidor) no seu dashboard em menos de 1 minuto." },
    { q: "E se algo falhar na criação?", a: "Se houver qualquer erro na provisão, você vê um botão 'Tentar novamente' no dashboard e o suporte é acionado automaticamente. Nenhum pagamento fica sem licença — garantia de reembolso integral em caso de falha." },
    { q: "Como funciona a taxa do dia 20?", a: "Todo dia 20 há renovação do servidor. Se não for paga, o login é suspenso automaticamente até a nova renovação. Cliente antigo paga R$ 250, cliente novo R$ 450." },
    { q: "Posso trocar de plano depois?", a: "Sim. Cliente antigo v4.5.7 pode fazer upgrade para v4.6 vitalício por R$ 600 — o processo é automático e mantém seu histórico." },
    { q: "O cupom BTMOB40 é seguro?", a: "Sim. Ele dá 40% de cashback no primeiro depósito, que fica no seu saldo e pode ser usado em compras futuras (limitado a 50% do valor de cada compra)." },
    { q: "Vocês emitem nota?", a: "Sim, o comprovante oficial do Mercado Pago é emitido no ato do pagamento e enviado por email pela própria operadora." },
  ];
  return (
    <section className="mt-16">
      <div className="mb-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">// perguntas frequentes</div>
        <h2 className="mt-2 font-display text-2xl md:text-3xl">Tire suas dúvidas em segundos</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {faq.map((it) => (
          <details key={it.q} className="group rounded-xl border border-border/50 bg-card/40 p-4 transition-colors open:border-primary/40 open:bg-card/60">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold group-open:text-primary">
              <span>{it.q}</span>
              <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ============ Plan Card ============
const PlanCard = memo(function PlanCard({ plan, coupon, cashback, useCash, isLoading, onBuy, featured }: {
  plan: Plan;
  coupon: Coupon | null;
  cashback: number;
  useCash: boolean;
  isLoading: boolean;
  onBuy: (s: string) => void;
  featured?: boolean;
}) {
  const price = Number(plan.price_brl);
  const b = useMemo(() => computeBreakdown(price, coupon, cashback, useCash), [price, coupon, cashback, useCash]);
  const hasBenefit = b.discount > 0 || b.cashbackApplied > 0 || b.cashbackEarn > 0;
  const meta = useMemo(() => metaFor(plan), [plan]);
  const Icon = meta.icon;
  const handleClick = useCallback(() => onBuy(plan.slug), [onBuy, plan.slug]);

  return (
    <div className={[
      "group relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 transition-all",
      featured
        ? "border-primary/50 bg-gradient-to-b from-primary/[0.08] via-card/60 to-card/40 shadow-[0_20px_60px_-20px_oklch(0.78_0.13_82/0.35)]"
        : "border-border/60 bg-card/50 hover:border-primary/30 hover:bg-card/70",
    ].join(" ")}>
      {featured && (
        <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
          <Crown className="h-3 w-3" /> Popular
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className={[
          "grid h-10 w-10 place-items-center rounded-lg border",
          featured ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 bg-background/40 text-muted-foreground",
        ].join(" ")}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate font-display text-lg leading-tight">{plan.name}</div>
          {meta.cadence && (
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{meta.cadence}</div>
          )}
        </div>
      </div>

      <p className="mt-4 min-h-[2.5rem] text-sm text-muted-foreground">{meta.tagline || plan.description}</p>

      <div className="mt-5">
        {hasBenefit && b.final < price ? (
          <>
            <div className="font-mono text-xs text-muted-foreground line-through">{formatBrl(price)}</div>
            <div className="font-display text-4xl font-semibold text-primary">{formatBrl(b.final)}</div>
          </>
        ) : (
          <div className="font-display text-4xl font-semibold">{formatBrl(price)}</div>
        )}
      </div>

      {meta.features.length > 0 && (
        <ul className="mt-5 space-y-2 border-t border-border/40 pt-4 text-sm">
          {meta.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-muted-foreground">
              <Check className={`mt-0.5 h-4 w-4 shrink-0 ${featured ? "text-primary" : "text-primary/70"}`} />
              <span className="text-foreground/90">{f}</span>
            </li>
          ))}
        </ul>
      )}

      {hasBenefit && (
        <ul className="mt-4 space-y-1 rounded-lg border border-primary/20 bg-primary/5 p-3 font-mono text-[11px]">
          {b.discount > 0 && (
            <li className="flex justify-between text-primary"><span>Desconto do cupom</span><span>-{formatBrl(b.discount)}</span></li>
          )}
          {b.cashbackApplied > 0 && (
            <li className="flex justify-between text-primary"><span>Cashback usado</span><span>-{formatBrl(b.cashbackApplied)}</span></li>
          )}
          {b.cashbackEarn > 0 && (
            <li className="flex justify-between text-primary/80"><span>Cashback estimado</span><span>+{formatBrl(b.cashbackEarn)}</span></li>
          )}
        </ul>
      )}

      <div className="mt-6 flex-1" />

      <Button
        className={[
          "w-full font-mono uppercase tracking-wider",
          featured ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
        ].join(" ")}
        variant={featured ? "default" : "outline"}
        onClick={handleClick}
        disabled={isLoading}
      >
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Comprar via PIX
      </Button>
      <div className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {hasBenefit ? "valor final confirmado no checkout" : "pagamento oficial mercado pago"}
      </div>
    </div>
  );
});

const PlanGroup = memo(function PlanGroup({ title, eyebrow, items, onBuy, loading, coupon, cashback, useCash, featuredSlug }: {
  title: string;
  eyebrow?: string;
  items: Plan[];
  onBuy: (s: string) => void;
  loading: string | null;
  coupon: Coupon | null;
  cashback: number;
  useCash: boolean;
  featuredSlug?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-16">
      <div className="mb-6 flex flex-col gap-1 border-b border-border/40 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// {title.toLowerCase()}</div>
          <h2 className="mt-1 font-display text-2xl md:text-3xl">{title}</h2>
        </div>
        {eyebrow && <span className="text-sm text-muted-foreground">{eyebrow}</span>}
      </div>
      <div className={`grid gap-5 ${items.length >= 3 ? "md:grid-cols-3" : items.length === 2 ? "md:grid-cols-2" : "md:grid-cols-1 md:mx-auto md:max-w-md"}`}>
        {items.map((p) => (
          <PlanCard
            key={p.slug}
            plan={p}
            coupon={coupon}
            cashback={cashback}
            useCash={useCash}
            isLoading={loading === p.slug}
            onBuy={onBuy}
            featured={featuredSlug === p.slug}
          />
        ))}
      </div>
    </section>
  );
});

// ============ Legacy lookup para clientes antigos ============
function LegacyLookup() {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ found: boolean; panels: ("v457" | "v46")[] } | null>(null);
  const [selectedPanel, setSelectedPanel] = React.useState<"v457" | "v46" | "">("");
  const [password, setPassword] = React.useState("");
  const [claiming, setClaiming] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const panelLabel = (p: string) => (p === "v46" ? "Shadow 4.6 (Vitalício)" : "Shadow 4.5.7 (Mensal)");

  async function run() {
    if (!email.trim()) return setErr("Informe seu email antigo");
    setBusy(true); setErr(null); setResult(null); setDone(false);
    try {
      const { checkLegacyEmail } = await import("@/lib/license.functions");
      const r = await checkLegacyEmail({ data: { email: email.trim().toLowerCase() } });
      setResult({ found: r.found, panels: r.panels as ("v457" | "v46")[] });
      if (r.found && r.panels.length === 1) setSelectedPanel(r.panels[0] as "v457" | "v46");
    } catch (e: any) {
      setErr(e?.message || "Falha ao verificar");
    } finally { setBusy(false); }
  }

  async function claim() {
    if (!selectedPanel) return setErr("Escolha o painel");
    if (!password.trim()) return setErr("Informe sua senha atual do painel");
    setClaiming(true); setErr(null);
    try {
      const { claimLegacyLicense } = await import("@/lib/license.functions");
      const r = await claimLegacyLicense({
        data: { email: email.trim().toLowerCase(), password: password.trim(), panel: selectedPanel },
      });
      setDone(true);
      if (r.already) alert("Essa licença já estava vinculada ao seu dashboard.");
      setTimeout(() => { window.location.href = "/dashboard"; }, 800);
    } catch (e: any) {
      setErr(e?.message || "Falha ao reivindicar");
    } finally { setClaiming(false); }
  }

  return (
    <div className="border-t border-border/40 px-5 py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-primary"
      >
        <span>Sou cliente antigo — vincular meu login existente</span>
        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErr(null); setResult(null); setDone(false); }}
              placeholder="Email do seu login antigo"
              className="flex-1 rounded border border-border bg-background px-3 py-2 font-mono text-sm"
              disabled={done}
            />
            <button
              type="button"
              onClick={run}
              disabled={busy || done}
              className="rounded border border-primary/40 bg-primary/10 px-4 py-2 font-mono text-xs uppercase text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              {busy ? "Verificando..." : "Verificar email"}
            </button>
          </div>

          {err && <div className="font-mono text-xs text-destructive">{err}</div>}

          {result && !result.found && (
            <div className="rounded border border-border/40 bg-background/40 p-3 font-mono text-xs text-muted-foreground">
              Email não encontrado nos painéis. Se você é cliente novo, escolha um plano acima normalmente.
            </div>
          )}

          {result?.found && !done && (
            <div className="space-y-3 rounded border border-primary/30 bg-primary/5 p-3 font-mono text-xs">
              <div className="text-primary">✓ Login encontrado em: {result.panels.map(panelLabel).join(" · ")}</div>

              {result.panels.length > 1 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase text-muted-foreground">Escolha qual licença vincular:</div>
                  <div className="flex flex-wrap gap-2">
                    {result.panels.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSelectedPanel(p)}
                        className={`rounded border px-3 py-1.5 text-[11px] uppercase ${selectedPanel === p ? "border-primary bg-primary/20 text-primary" : "border-border/50 text-muted-foreground hover:border-primary/40"}`}
                      >
                        {panelLabel(p)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="text-[10px] uppercase text-muted-foreground">Sua senha atual do painel</div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErr(null); }}
                  placeholder="Senha do login"
                  className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm"
                  autoComplete="off"
                />
                <div className="text-[10px] text-muted-foreground">
                  Guardamos criptografada. Se você não lembra a senha, abra um chamado em <span className="text-primary">/suporte</span>.
                </div>
              </div>

              <button
                type="button"
                onClick={claim}
                disabled={claiming || !selectedPanel || !password.trim()}
                className="w-full rounded border border-primary/50 bg-primary/15 px-4 py-2 font-mono text-xs uppercase text-primary hover:bg-primary/25 disabled:opacity-50"
              >
                {claiming ? "Vinculando..." : "→ Vincular licença ao meu dashboard"}
              </button>

              <div className="text-[10px] text-muted-foreground">
                Após vincular, sua licença aparece no dashboard com taxa de servidor R$ 250/mês (preço legacy). Vencimento realinhado para o próximo dia 20.
              </div>
            </div>
          )}

          {done && (
            <div className="rounded border border-primary/60 bg-primary/10 p-3 text-center font-mono text-xs text-primary">
              ✓ Licença vinculada. Redirecionando para o dashboard...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
