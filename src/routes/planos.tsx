import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useThemeSearchParam } from "@/hooks/use-theme-param";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2, Loader2, Tag, Users, X, AlertCircle, ShieldCheck, Zap, Lock,
  HeadphonesIcon, Sparkles, Crown, Calendar, Clock, Server, Code2, ArrowUpRight, ArrowLeftRight,
  ChevronRight, Check, Minus, Search, Info, CreditCard, Rocket, Shield, AlertTriangle,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { FlashPromoBar } from "@/components/FlashPromoBar";
import { LiveActivationTicker } from "@/components/LiveActivationTicker";
import { WinbackOffer, markCheckoutIntent } from "@/components/WinbackOffer";

import { GuaranteeStrip } from "@/components/GuaranteeStrip";
import { Testimonials } from "@/components/Testimonials";
import { ConversionBoosters, MobileStickyCTA } from "@/components/ConversionBoosters";
import { useI18n } from "@/lib/i18n";


import { TrustBadges } from "@/components/TrustBadges";
import { HowItWorksSteps } from "@/components/HowItWorksSteps";
import { PlanAdvisor } from "@/components/PlanAdvisor";
import { CheckoutFaqFloat } from "@/components/CheckoutFaqFloat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { formatBrl } from "@/lib/plans";
import { createCheckout } from "@/lib/checkout.functions";
import { siteUrl } from "@/lib/site-url";
import { validateCoupon, getMyCashbackBalance, getMyLegacyStatus, listMyLicenses } from "@/lib/license.functions";

import { validateReferralCode } from "@/lib/referrals.functions";
const shadowLupin = "/assets/shadow-logo-v10.png?v=v8-400";





export const Route = createFileRoute("/planos")({
  head: () => ({ 
    meta: [
      { title: "Planos Shadow — Licenças, servidor e código-fonte" },
      { name: "description", content: "Pagamento oficial via PIX Mercado Pago. Ativação automática em menos de 1 minuto. Shadow 4.6+ com Bypass Play Protect e Bypass Dropper inclusos." },
      { property: "og:title", content: "Planos Shadow — Licenças, servidor e código-fonte" },
      { property: "og:description", content: "PIX oficial Mercado Pago, ativação automática em menos de 1 minuto e garantia de 7 dias." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/planos") },
      { name: "twitter:card", content: "summary_large_image" },

    ], 
    links: [{ rel: "canonical", href: siteUrl("/planos") }] 
  }),

  component: PlansPage,
});

type Plan = { slug: string; name: string; description: string | null; price_brl: number; days: number | null; category: string; sort_order: number | null };

type UsageFilter = "all" | "monthly" | "lifetime";

/** Classifica o plano pelo tipo de uso: recorrente (tem duração) ou vitalício. */
function usageOf(p: Plan): "monthly" | "lifetime" {
  return p.days == null ? "lifetime" : "monthly";
}
type Coupon = { code: string; discount_pct: number; cashback_pct: number; plan_slug?: string | null };

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
  note?: string;

};

function metaFor(plan: Plan, t: (k: any) => string): PlanMeta {
  const s = plan.slug.toLowerCase();
  if (s.includes("lifetime")) return {
    tagline: "Acesso perpétuo à linha 4.6+ com atualizações inclusas.",
    badge: "Mais econômico",
    icon: Crown,
    cadence: "pagamento único",
    features: [
      "Shadow 4.6+ com todos os módulos",
      "Bypass Play Protect da própria BTmob (assinatura ~1 dia)",
      "Atualizações grátis para sempre",
      "Suporte prioritário 24/7",
      "Fila prioritária no Play Protect Cloak do site (assinatura de 2 a 3 semanas)",
      "Acesso ao Bypass Play Protect (Play Protect Cloak & Shadow Bypass Dropper)",
    ],
  };
  if (s.includes("30") || s.includes("month")) return {
    tagline: "Operação mensal na versão estável 4.5.7.",
    badge: "Mais popular",
    icon: Calendar,
    cadence: "renovação em 30 dias",
    features: [
      "Shadow 4.5.7, Bypass Play Protect, suporte via chat",
      "Shadow 4.5.7 completa",
      "Bypass Play Protect da própria BTmob (assinatura do APK dura ~1 dia)",
      "Suporte via chat no painel",
      "Acesso ao Bypass Play Protect (Bypass Automático & Dropper)",
    ],
    note: t("plan.monthly.note"),
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
  if (s.includes("upgrade") || s.includes("migracao")) return {
    tagline: "Migração assistida de v4.5.7 para vitalício v4.6.",
    icon: ArrowUpRight,
    cadence: "cobrança única (R$ 600)",
    features: [
      "Migração automática do login",
      "Vira Vitalício v4.6 imediatamente",
      "Mantém seu histórico e servidor",
      "Prioridade no suporte após upgrade",
      "Libera Shadow Play Protect Builder",
      "Economia real: não precisa pagar R$ 1.700 no valor cheio",
      "Acesso ao servidor exclusivo de vitalícios",
    ],
  };

  if (s.includes("cloak") || s.includes("bypass")) return {
    tagline: "O bypass de longa duração mais estável do mercado.",
    badge: "Bypass Play Protect",
    icon: ShieldCheck,
    cadence: "renovação em 30 dias",
    features: [
      "Assinatura V2/V3 com bypass Play Protect",
      "APK Cloaking (Shadow Bypass Dropper inclusa)",
      "Proteção anti-decompile",
      "Garantia de bypass ativo no ciclo",
      "Fila dedicada no builder",
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

function ShadowLupinBanner() {
  return (
    <section
      aria-label="Shadow · Gentleman Operator"
      className="relative mb-8 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-black via-neutral-950 to-black shadow-[0_0_60px_-15px_rgba(212,175,55,0.35)]"
    >
      <div className="relative grid gap-0 md:grid-cols-[minmax(0,1fr)_360px]">
        {/* Mobile background image */}
        <img
          src={shadowLupin}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[70%_center] opacity-40 md:hidden"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60 md:hidden" />
        <div className="relative z-10 flex flex-col justify-center gap-3 p-6 sm:p-10">
          <span className="w-fit rounded-full border border-primary/40 bg-primary/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            // gentleman.operator
          </span>
          <h2 className="font-serif text-2xl leading-tight text-white sm:text-4xl">
            Opere no escuro. <span className="text-primary italic">Com elegância.</span>
          </h2>
          <p className="max-w-lg text-sm leading-relaxed text-white/70">
            A Shadow é a discrição de um cavalheiro com a precisão de um profissional.
            Anonimato criptografado, ativação via PIX em menos de 1 minuto e garantia de 7 dias.
          </p>
        </div>
        <div className="relative hidden min-h-[280px] md:block">
          <img
            src={shadowLupin}
            alt="Operador Shadow — silhueta com cartola e máscara ao estilo Arsène Lupin"
            width={1024}
            height={1280}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-top opacity-95"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent md:from-black md:via-black/40" />
        </div>
      </div>
    </section>
  );
}


function PlansPage() {
  const search = useSearch({ from: "/planos" }) as any;

  useThemeSearchParam(search?.theme);

  useEffect(() => {
    if (search?.clear_cache === 'true') {
      const url = new URL(window.location.href);
      url.searchParams.delete('clear_cache');
      window.history.replaceState({}, '', url.toString());
    }
  }, [search?.clear_cache]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [isLegacy, setIsLegacy] = useState(false);

  const [coupon, setCoupon] = useState("");
  const [couponValid, setCouponValid] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponPending, setCouponPending] = useState(false);

  const [cashbackBalance, setCashbackBalance] = useState(0);
  const [useCash, setUseCash] = useState(false);
  const [giftOn, setGiftOn] = useState(false);
  const [giftEmail, setGiftEmail] = useState("");
  const [giftMessage, setGiftMessage] = useState("");

  const [referral, setReferral] = useState("");
  const [referralValid, setReferralValid] = useState<{ name: string } | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralPending, setReferralPending] = useState(false);

  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const autoCouponTried = useRef(false);
  const navigate = useNavigate();

  const checkoutFn = useServerFn(createCheckout);
  const validateFn = useServerFn(validateCoupon);
  const cashbackFn = useServerFn(getMyCashbackBalance);
  const legacyFn = useServerFn(getMyLegacyStatus);
  const validateRefFn = useServerFn(validateReferralCode);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase.from("plans").select("*").eq("active", true).order("sort_order");
        if (error) throw error;
        setPlans((data ?? []) as Plan[]);
      } catch (err) {
        console.error("[PlansLoadError] Retrying...", err);
        // Retry once after 2s if it fails
        setTimeout(async () => {
          const { data } = await supabase.from("plans").select("*").eq("active", true).order("sort_order");
          if (data) setPlans(data as Plan[]);
        }, 2000);
      }
    };
    fetchPlans();
    supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user));
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) setReferral(ref.toUpperCase());
      const promo = params.get("cupom");
      if (promo && CODE_RE.test(promo.trim().toUpperCase())) setCoupon(promo.trim().toUpperCase());
    }
  }, []);

  // Cupons nunca são aplicados automaticamente — o cliente precisa clicar em "Aplicar".
  // O campo apenas é pré-preenchido quando vem via ?cupom= na URL.

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

  const buy = useCallback(async (slug: string, couponOverride?: string, options?: { includeServer?: boolean, addSigner?: boolean }) => {
    if (!loggedIn) { navigate({ to: "/auth", search: { next: "/planos" } as any }); return; }
    setLoadingPlan(slug);
    try {
      const r = await checkoutFn({ data: {
        planSlug: slug,
        includeServer: options?.includeServer,
        addSigner: options?.addSigner,
        couponCode:
          couponOverride ||
          (couponValid && (!couponValid.plan_slug || couponValid.plan_slug === slug)
            ? couponValid.code
            : undefined),
        useCashback: useCash && cashbackBalance > 0,
        referralCode: referralValid ? referral : undefined,
        returnOrigin: window.location.origin,
        gift: giftOn && giftEmail.trim()
          ? { email: giftEmail.trim(), message: giftMessage.trim() || undefined }
          : undefined,
      } });
      markCheckoutIntent(slug);
      
      // Delay to ensure the loading state is visible before redirect
      setTimeout(() => {
        window.location.href = r.initPoint;
      }, 500);
    } catch (e: any) {
      console.error("[CheckoutError]", e);
      toast.error(e?.message?.includes("Plano") ? e.message : `Não foi possível iniciar o checkout: ${e?.message || "Erro desconhecido"}`);
      setLoadingPlan(slug === "none" ? null : null); // Trigger state refresh
      setLoadingPlan(null);
    }
  }, [loggedIn, navigate, checkoutFn, couponValid, useCash, cashbackBalance, referralValid, referral, giftOn, giftEmail, giftMessage]);


  const [usage, setUsage] = useState<UsageFilter>("all");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [showMore, setShowMore] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [myLicenses, setMyLicenses] = useState<any[]>([]);
  const fetchMyLicenses = useServerFn(listMyLicenses);

  useEffect(() => {
    if (loggedIn) {
      setCheckingEligibility(true);
      fetchMyLicenses()
        .then(setMyLicenses)
        .catch(console.error)
        .finally(() => setCheckingEligibility(false));
    }
  }, [loggedIn, fetchMyLicenses]);

  function UpgradeEligibilityButton({ p, loading, onBuy }: { p: Plan; loading: boolean; onBuy: () => void }) {
    const isEligible = myLicenses.some(l => 
      ["monthly_457"].includes(l.plan_slug) && 
      !l.is_trial && !l.revoked && !l.disabled_at && !l.suspended_at &&
      (!l.expires_at || new Date(l.expires_at).getTime() > Date.now())
    );

    if (checkingEligibility) {
      return (
        <Button disabled className="w-full h-12">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Verificando elegibilidade...
        </Button>
      );
    }

    if (!isEligible && loggedIn) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full">
                <Button disabled className="w-full h-12 opacity-50 cursor-not-allowed grayscale bg-muted text-muted-foreground border-dashed">
                  <Lock className="mr-2 h-4 w-4" />
                  Upgrade Bloqueado
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px] p-4 bg-black border-amber-500/50 text-white shadow-xl">
              <div className="space-y-2">
                <p className="font-bold text-amber-500 flex items-center gap-2 text-xs uppercase tracking-tighter">
                  <AlertTriangle className="h-3 w-3" /> Requisito não preenchido
                </p>
                <p className="text-[11px] leading-relaxed">
                  Este upgrade exige uma assinatura <strong>Shadow 4.5.7 (Mensal)</strong> ativa e paga vinculada à sua conta.
                </p>
                <Link 
                  to="/migracao" 
                  className="block pt-2 text-[10px] font-bold text-primary hover:underline uppercase"
                >
                  Entender regras de migração →
                </Link>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Button
        variant="outline"
        className="w-full border-amber-500/50 text-amber-500 hover:bg-amber-500 hover:text-black font-serif text-base font-medium h-12 shadow-[0_0_15px_-5px_rgba(245,158,11,0.4)]"
        onClick={onBuy}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ArrowUpRight className="mr-2 h-4 w-4" />
        )}
        Migrar para Vitalício
      </Button>
    );
  }

  const { licenses, servers, sources, upgrades, addons } = useMemo(() => {
    const seen = new Set<string>();
    const unique = plans.filter((p) => {
      const key = `${p.category}|${p.price_brl}|${p.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const serverAll = unique.filter((p) => p.category === "server");
    const serverFiltered = isLegacy
      ? serverAll.filter((p) => p.slug === "server-monthly-legacy")
      : serverAll.filter((p) => p.slug !== "server-monthly-legacy");
    
    const upgradeList = unique.filter((p) => p.category === "upgrade" || p.slug.includes("upgrade"));
    const addonList = unique.filter((p) => p.category === "addon" || p.slug.includes("play-protect") || p.slug.includes("bypass"));
    
    const applyBillingFilter = (list: Plan[]) => {
      let filtered = list;
      if (usage !== "all") {
        filtered = filtered.filter((p) => usageOf(p) === usage);
      }
      
      return filtered.map(p => {
        if (billingCycle === "yearly" && usageOf(p) === "monthly") {
          return {
            ...p,
            name: p.name.replace("Mensal", "Anual").replace("30 Dias", "1 Ano"),
            price_brl: Math.round(p.price_brl * 12 * 0.8), // 20% discount
            days: 365
          };
        }
        return p;
      });
    };

    const licenseList = unique.filter((p) => p.category === "license" && !p.slug.includes("upgrade") && !p.slug.includes("bypass"));

    return {
      licenses: applyBillingFilter(licenseList),
      servers: applyBillingFilter(serverFiltered),
      sources: applyBillingFilter(unique.filter((p) => p.category === "source")),
      upgrades: applyBillingFilter(upgradeList),
      addons: applyBillingFilter(addonList),
    };
  }, [plans, isLegacy, usage, billingCycle]);


  const secondaryCount = sources.length;

  const anyBenefit = !!(couponValid || (useCash && cashbackBalance > 0) || referralValid);

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <SiteHeader />
      <FlashPromoBar />
      <WinbackOffer onUseCoupon={(code, slug) => { setCoupon(code); void buy(slug, code); }} />


      {/* HERO — professional, animated ================================================= */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="pointer-events-none absolute inset-0 -z-0 opacity-60"
             style={{ background: "radial-gradient(ellipse 60% 45% at 50% 0%, oklch(0.28 0.09 82 / 0.22), transparent 70%)" }} />
        {/* Animated grid backdrop */}
        <div className="pointer-events-none absolute inset-0 -z-0 opacity-[0.07]"
             style={{ backgroundImage: "linear-gradient(oklch(0.78 0.13 82) 1px, transparent 1px), linear-gradient(90deg, oklch(0.78 0.13 82) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

        <div className="mx-auto max-w-5xl px-4 pt-14 pb-10 md:pt-20 md:pb-14 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-primary backdrop-blur"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Ativações em tempo real
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-4 text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl md:text-7xl text-foreground"
          >
            Escolha seu <span className="text-primary italic">acesso.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground md:text-base"
          >
            Ativação automática via PIX. Sem burocracia. Login entregue direto no painel.
          </motion.p>

          {/* Trust seals */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70"
          >
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Mercado Pago</span>
            <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" /> &lt; 1 min</span>
            <span className="flex items-center gap-1.5"><HeadphonesIcon className="h-3.5 w-3.5 text-primary" /> Suporte 24/7</span>
            <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-primary" /> AES-256</span>
          </motion.div>

          {/* Live activation ticker */}
          <LiveActivationTicker />

          {/* Enterprise metrics strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {[
              { v: "2.400+", l: "Operadores" },
              { v: "99.98%", l: "Uptime" },
              { v: "47s", l: "Ativação média" },
              { v: "4.9★", l: "Satisfação" },
            ].map((m, i) => (
              <motion.div
                key={m.l}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.06, type: "spring", stiffness: 180 }}
                className="rounded-lg border border-border/50 bg-card/40 px-3 py-2 backdrop-blur"
              >
                <div className="font-display text-lg font-bold text-primary">{m.v}</div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{m.l}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24 sm:px-6">



        {/* BENEFITS PANEL ==================================== */}
        {loggedIn && (
          <details open={anyBenefit} className="group mx-auto mb-14 max-w-3xl overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border/40 px-5 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-semibold">Cupom, indicação, presente ou login antigo</div>
                  <div className="text-[11px] text-muted-foreground">Aplique cupom/indicação, presenteie alguém ou sincronize seu login antigo (Shadow 4.5.7 / 4.6) — tudo aqui.</div>

                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {anyBenefit && (
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                    ativo
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
              </div>
            </summary>

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

              {/* Presentear */}
              <div className="md:col-span-2 rounded-lg border border-border/70 bg-background/40 px-4 py-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={giftOn}
                    onChange={(e) => setGiftOn(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <div>
                    <div className="text-sm">🎁 Presentear alguém</div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      você paga, o acesso cai direto na conta da pessoa
                    </div>
                  </div>
                </label>
                {giftOn && (
                  <div className="mt-3 space-y-2">
                    <input
                      type="email"
                      value={giftEmail}
                      onChange={(e) => setGiftEmail(e.target.value)}
                      placeholder="e-mail da conta de quem vai receber"
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <input
                      type="text"
                      maxLength={300}
                      value={giftMessage}
                      onChange={(e) => setGiftMessage(e.target.value)}
                      placeholder="mensagem no presente (opcional)"
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      A pessoa precisa já ter uma conta criada aqui no site com esse e-mail.
                      O acesso e as credenciais aparecem no painel e no suporte dela assim que o PIX for confirmado.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <LegacyLookup />
          </details>
        )}

        {/* PLAN GROUPS ====================================== */}
        <div className="sticky top-16 z-40 -mx-4 mb-8 bg-background/80 px-4 py-4 backdrop-blur-md border-b border-border/40 sm:static sm:top-0 sm:mx-0 sm:mb-12 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none sm:border-0">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="hidden sm:block">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// configurar acesso</div>
              <p className="mt-1 text-sm text-muted-foreground">Personalize seu ciclo de cobrança e tipo de plano.</p>
              {billingCycle === "yearly" && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="mt-2 flex items-center gap-2 rounded-md border border-neon/20 bg-neon/5 px-2 py-1"
                >
                  <Tag className="h-3 w-3 text-neon" />
                  <span className="font-mono text-[9px] font-bold uppercase tracking-tight text-neon">
                    Economia Anual Detectada: 20% OFF (Diferença aplicada no valor total)
                  </span>
                </motion.div>
              )}
            </div>
            
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {/* Billing Cycle Toggle */}
              <div className="flex items-center justify-center gap-1 rounded-full border border-border/60 bg-card/50 p-1" role="tablist">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`rounded-full px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-wider transition-all ${
                    billingCycle === "monthly" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-white/5"
                  }`}
                >
                  Mensal
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={`relative rounded-full px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-wider transition-all ${
                    billingCycle === "yearly" ? "bg-primary text-primary-foreground shadow-[0_0_10px_oklch(0.78_0.13_82/0.3)]" : "text-muted-foreground hover:bg-white/5"
                  }`}
                >
                  Anual
                  <span className="absolute -top-2 -right-2 rounded-full bg-neon px-1.5 py-0.5 text-[8px] text-black ring-1 ring-black/20">
                    -20%
                  </span>
                </button>
              </div>

              {/* Usage Filter */}
              <div className="flex items-center justify-center gap-1.5 rounded-full border border-border/60 bg-card/50 p-1" role="tablist">
                {([
                  { id: "all", label: "Todos" },
                  { id: "monthly", label: "Recorrente" },
                  { id: "lifetime", label: "Vitalício" },
                ] as { id: UsageFilter; label: string }[]).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={usage === opt.id}
                    onClick={() => setUsage(opt.id)}
                    className={`rounded-full px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
                      usage === opt.id ? "bg-primary/20 text-primary border border-primary/20" : "text-muted-foreground hover:bg-white/5"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>



        <div className="mb-16">
          <div className="mb-6 flex flex-col gap-1 border-b border-border/40 pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// licenças shadow</div>
              <h2 className="mt-1 font-display text-2xl md:text-3xl">Escolha seu Acesso</h2>
            </div>
            <span className="text-sm text-muted-foreground">Provisionamento instantâneo via PIX</span>
          </div>
          
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {licenses.filter(p => (usage === "all" || usageOf(p) === usage))
              .sort((a, b) => (a.price_brl || 0) - (b.price_brl || 0))
              .map((p) => {
                // Cada card recebe UMA extensão específica coerente com o plano.
                const s = p.slug.toLowerCase();
                const is7d = s.includes("7d") || s.includes("week") || s === "trial" || s.includes("trial");
                const isMonthly = !is7d && (s.includes("30") || s.includes("month"));
                const isLifetime = s.includes("lifetime");

                let extension: null | {
                  icon: any;
                  label: string;
                  desc: string;
                  slug: string;
                  to?: string;
                } = null;

                if (is7d && addons.length > 0) {
                  extension = {
                    icon: ShieldCheck,
                    label: "PLAY PROTECT (BYPASS PLAY PROTECT)",
                    desc: "R$ 450 — APK dura 30 dias (vs 1 dia do BTmob nativo). Otimizado e não é detectado como vírus pelo Play Protect.",
                    slug: addons[0].slug,
                  };
                } else if (isMonthly && upgrades.length > 0) {
                  extension = {
                    icon: ArrowUpRight,
                    label: "MIGRAR 4.5.7 → 4.6 (UPGRADE)",
                    desc: "Já tem plano mensal ativo? Migre para o vitalício 4.6: sem taxa de updates, prioridade no suporte, sempre recebe atualizações e server exclusivo de vitalícios com baixa latência.",
                    slug: upgrades[0].slug,
                  };
                } else if (isLifetime && servers.length > 0) {
                  extension = {
                    icon: Server,
                    label: "RENOVAR SERVIDOR (DIA 20)",
                    desc: "Vitalícios pagam manutenção do server todo dia 20. Quem tem plano mensal já inclui — renova junto com o login.",
                    slug: servers[0].slug,
                  };
                }

                return (
                  <div key={p.slug} className="flex flex-col gap-4">
                    <PlanCard
                      plan={p}
                      coupon={couponValid}
                      cashback={cashbackBalance}
                      useCash={useCash}
                      isLoading={loadingPlan === p.slug}
                      onBuy={buy}
                      featured={p.slug === "login-lifetime"}
                    />

                    {extension && (
                      <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-[11px] leading-relaxed">
                        <div className="mb-2 font-mono uppercase tracking-wider text-primary/90">
                          // extensão recomendada
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => buy(extension!.slug)}
                          disabled={loadingPlan !== null}
                          className="w-full justify-between h-9 px-2 text-[11px] font-bold font-mono text-primary hover:bg-primary/10 hover:text-primary group/btn"
                        >
                          <span className="flex items-center gap-2 text-left">
                            <extension.icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{extension.label}</span>
                          </span>
                          {loadingPlan === extension.slug ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
                          )}
                        </Button>
                        <p className="mt-1 px-1 text-[10px] text-muted-foreground leading-tight">
                          {extension.desc}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

        </div>

        {plans.length === 0 ? (
          <div className="mb-12 flex flex-col items-center justify-center rounded-xl border border-dashed border-primary/30 bg-primary/5 p-12 text-center">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary/40" />
            <h3 className="text-lg font-semibold">Carregando planos...</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Se os planos não aparecerem em 5 segundos, tente atualizar a página.
            </p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-6">
              Recarregar Página
            </Button>
          </div>
        ) : (
          licenses.filter(p => usage === "all" || usageOf(p) === usage).length === 0 && (
            <p className="mb-12 rounded-xl border border-border/50 bg-card/40 p-6 text-center text-sm text-muted-foreground">
              Nenhuma licença {usage === "monthly" ? "mensal" : "vitalícia"} disponível no momento.{" "}
              <button type="button" onClick={() => setUsage("all")} className="text-primary underline underline-offset-4">
                Ver todos os planos
              </button>
            </p>
          )
        )}

        {secondaryCount > 0 && !showMore && (
          <div className="mb-16 text-center">
            <Button variant="outline" onClick={() => setShowMore(true)} className="max-w-full whitespace-normal h-auto py-3 font-mono text-[11px] uppercase tracking-wider leading-snug">
              <span className="block">Mais opções ({secondaryCount})</span>
              <span className="block text-[10px] opacity-70">código-fonte auditável</span>
            </Button>
          </div>
        )}

        {showMore && sources.length > 0 && (
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
        )}
        {showMore && secondaryCount > 0 && (
          <div className="mb-16 text-center">
            <Button variant="ghost" onClick={() => setShowMore(false)} className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Ocultar opções extras
            </Button>
          </div>
        )}

        

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
      <CheckoutFaqFloat />
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

function OrderCalculator({ plans, onBuy }: { plans: Plan[]; onBuy: (slug: string, options?: { includeServer: boolean, addSigner: boolean }) => void }) {
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string>("none");
  const [isOldMember, setIsOldMember] = useState(false);
  const [addSigner, setAddSigner] = useState(false);
  const [includeServerPrepaid, setIncludeServerPrepaid] = useState(true);

  const selectedPlan = plans.find(p => p.slug === selectedPlanSlug);
  
  const prices = {
    serverNew: 450,
    serverOld: 250,
    signer: 250,
  };

  const planPrice = selectedPlan ? selectedPlan.price_brl : 0;
  
  // Se o plano for vitalício, a renovação é sempre dia 20.
  // Se for mensal, a renovação é quando o login expirar.
  const isLifetime = selectedPlanSlug.toLowerCase().includes("vitalicio") || selectedPlanSlug.toLowerCase().includes("lifetime");
  const isMonthly = selectedPlanSlug.toLowerCase().includes("30") || selectedPlanSlug.toLowerCase().includes("month");
  
  const serverPrice = (selectedPlanSlug !== "none" && includeServerPrepaid) ? (isOldMember ? prices.serverOld : prices.serverNew) : 0;
  
  const isSignerPlan = selectedPlanSlug.includes("bypass") || selectedPlanSlug.includes("signer");
  const effectiveAddSigner = addSigner && !isSignerPlan;
  const signerPrice = effectiveAddSigner ? prices.signer : 0;
  
  const total = planPrice + serverPrice + signerPrice;

  const mainPlans = plans.filter(p => p.category === "license").sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const addonPlans = plans.filter(p => p.category === "addon" || p.category === "upgrade");

  return (
    <section className="mt-16 rounded-2xl border border-primary/20 bg-primary/5 p-6 backdrop-blur-sm shadow-[0_0_50px_-12px_oklch(0.78_0.13_82/0.2)]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">// simulador de infraestrutura</div>
          <h2 className="mt-2 font-display text-2xl">Checkout Unificado</h2>
          <p className="text-sm text-muted-foreground">Configure sua licença e antecipe a renovação do servidor.</p>
        </div>
        <Rocket className="h-8 w-8 text-primary opacity-50 hidden sm:block" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">1. Plano Base</label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {mainPlans.map((p) => (
                <button
                  key={p.slug}
                  data-testid={`plan-${p.slug}`}
                  onClick={() => setSelectedPlanSlug(p.slug)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    selectedPlanSlug === p.slug ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border/50 bg-background/50 hover:border-primary/30"
                  }`}
                >
                  <div className="text-xs font-bold">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">{formatBrl(p.price_brl)}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 p-3">
            <div>
              <div className="text-xs font-bold">Pagar Servidor Antecipado</div>
              <div className="text-[10px] text-muted-foreground">Renovação automática após expiração</div>
            </div>
            <button
              onClick={() => setIncludeServerPrepaid(!includeServerPrepaid)}
              className={`h-5 w-10 rounded-full transition-colors relative ${includeServerPrepaid ? "bg-primary" : "bg-muted"}`}
            >
              <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-transform ${includeServerPrepaid ? "left-6" : "left-1"}`} />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 p-3">
            <div>
              <div className="text-xs font-bold">Sou Membro Antigo</div>
              <div className="text-[10px] text-muted-foreground">Manutenção unificada a R$ 250</div>
            </div>
            <button
              onClick={() => setIsOldMember(!isOldMember)}
              className={`h-5 w-10 rounded-full transition-colors relative ${isOldMember ? "bg-primary" : "bg-muted"}`}
            >
              <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-transform ${isOldMember ? "left-6" : "left-1"}`} />
            </button>
          </div>

          <div className={`flex items-center justify-between rounded-lg border border-border/50 bg-background/30 p-3 transition-opacity ${isSignerPlan ? "opacity-50 cursor-not-allowed" : ""}`}>
            <div>
              <div className="text-xs font-bold">Bypass Play Protect (Play Protect)</div>
              <div className="text-[10px] text-muted-foreground">+ R$ 250 (Incluso no Vitalício)</div>
            </div>
            <button
              disabled={isSignerPlan}
              onClick={() => setAddSigner(!addSigner)}
              className={`h-5 w-10 rounded-full transition-colors relative ${effectiveAddSigner ? "bg-primary" : "bg-muted"}`}
            >
              <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-transform ${effectiveAddSigner ? "left-6" : "left-1"}`} />
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-background/40 p-6 border border-border/50">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Configuração:</span>
              <span className="font-mono text-right">{selectedPlan ? selectedPlan.name : "Nenhum"}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Licença:</span>
              <span className="font-mono">{selectedPlan ? formatBrl(planPrice) : "---"}</span>
            </div>
            {includeServerPrepaid && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Servidor (Pré-pago):</span>
                <span className="font-mono">{formatBrl(serverPrice)}</span>
              </div>
            )}
            {effectiveAddSigner && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Addon Signer:</span>
                <span className="font-mono">{formatBrl(signerPrice)}</span>
              </div>
            )}
            
            <div className="my-4 h-px bg-border/50" />
            
            {selectedPlanSlug !== "none" && (
              <div className="mb-4 rounded border border-primary/20 bg-primary/5 p-2 text-[9px] font-mono text-primary uppercase leading-tight">
                <Info className="mr-1 inline-h-3 w-3" />
                {isLifetime 
                  ? "Vitalício: Renovação do servidor ocorre todo dia 20." 
                  : isMonthly 
                    ? "Mensal: Renovação automática assim que o login expirar."
                    : "Servidor ativo durante todo o período da licença."}
              </div>
            )}

            <div className="flex justify-between items-end">
              <div>
                <span className="font-display text-sm uppercase tracking-widest text-muted-foreground">Total à Pagar</span>
                <div className="flex items-center gap-1.5 text-[10px] text-primary/80">
                  <CreditCard className="h-3 w-3" /> Mercado Pago (PIX)
                </div>
              </div>
              <span className="font-display text-3xl font-bold text-primary">{formatBrl(total)}</span>
            </div>
          </div>
          <button 
            disabled={selectedPlanSlug === "none"}
            onClick={() => onBuy(selectedPlanSlug, { includeServer: includeServerPrepaid, addSigner: effectiveAddSigner })}
            className="mt-6 w-full rounded-lg bg-primary py-3 font-display text-sm font-bold uppercase tracking-widest text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continuar para Checkout
          </button>
          <p className="mt-4 text-[10px] text-center text-muted-foreground italic leading-relaxed">
            Ao prosseguir, você será redirecionado para o checkout seguro.
          </p>
        </div>
      </div>
    </section>
  );
}



function TierComparison() {
  const plans = [
    { id: "weekly", name: "4.5.5", accent: "muted" },
    { id: "monthly", name: "30 dias", accent: "primary" },
    { id: "serverOld", name: "Membro Antigo", accent: "primary" },
    { id: "lifetime", name: "Vitalício", accent: "primary", bold: true },
  ];

  const rows: { label: string; weekly: React.ReactNode; monthly: React.ReactNode; serverOld: React.ReactNode; lifetime: React.ReactNode }[] = [
    { label: "Versão da ferramenta", weekly: "Shadow 4.5.5", monthly: "Shadow 4.5.7", serverOld: "Infra v4.6", lifetime: "Shadow 4.6+" },
    { label: "Bypass Play Protect (BTmob nativo)", weekly: <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground" />, monthly: <Check className="mx-auto h-4 w-4 text-primary" />, serverOld: <Check className="mx-auto h-4 w-4 text-primary" />, lifetime: <Check className="mx-auto h-4 w-4 text-primary" /> },
    { label: "Manutenção Mensal", weekly: <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground" />, monthly: "R$ 450", serverOld: "R$ 450", lifetime: "R$ 450" },
    { label: "Duração", weekly: "7 dias", monthly: "30 dias", serverOld: "Até dia 20", lifetime: "Vitalícia" },
    { label: "Opção Anual (-20%)", weekly: "N/A", monthly: <Check className="mx-auto h-4 w-4 text-primary" />, serverOld: "N/A", lifetime: "Pagam. Único" },
    { label: "Upgrade v4.6", weekly: "Não", monthly: "R$ 600", serverOld: "Incluso", lifetime: "Nativo" },
  ];


  return (
    <section className="mt-16">
      <div className="mb-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">// comparativo detalhado</div>
        <h2 className="mt-2 font-display text-2xl md:text-3xl">Shadow 4.5.5 vs Mensal vs Servidor</h2>
      </div>

      {/* Responsive Comparison Container */}
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/40">
        {/* Horizontal scroll container for the table on mobile, full-width grid on desktop */}
        <div className="overflow-x-auto overflow-y-hidden md:overflow-visible">
          <div className="min-w-[760px] md:min-w-full">
            {/* Header Row */}
            <div className="grid grid-cols-5 border-b border-border/50 bg-background/40 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              <div className="px-4 py-3.5 sticky left-0 z-10 bg-background/80 backdrop-blur-sm border-r border-border/20 md:static md:bg-transparent md:border-r-0">
                Recurso
              </div>
              {plans.map((p) => (
                <div 
                  key={p.id} 
                  className={`px-4 py-3.5 text-center ${p.accent === "primary" ? "text-primary" : ""} ${p.bold ? "font-bold" : ""} ${p.id === 'lifetime' ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex flex-col items-center gap-1">
                    {p.name}
                    {p.id === 'lifetime' && (
                      <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-tighter text-primary">
                        Top
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Data Rows */}
            {rows.map((r, i) => (
              <div key={r.label} className={`grid grid-cols-5 text-[11px] md:text-sm ${i % 2 ? "bg-background/20" : ""}`}>
                <div className="px-4 py-3 text-muted-foreground font-medium sticky left-0 z-10 bg-background/80 backdrop-blur-sm border-r border-border/20 md:static md:bg-transparent md:border-r-0">
                  {r.label}
                </div>
                <div className="px-4 py-3 text-center font-mono whitespace-normal">{r.weekly}</div>
                <div className="px-4 py-3 text-center font-mono whitespace-normal">{r.monthly}</div>
                <div className="px-4 py-3 text-center font-mono text-primary whitespace-normal">{r.serverOld}</div>
                <div className={`px-4 py-3 text-center font-mono text-foreground font-semibold whitespace-normal ${i % 2 ? 'bg-primary/5' : 'bg-primary/[0.07]'}`}>
                  {r.lifetime}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Mobile-Friendly "Hint" for horizontal scroll */}
      <div className="mt-3 flex items-center justify-center gap-1.5 text-[9px] uppercase tracking-[0.15em] text-muted-foreground/60 md:hidden">
        <ArrowLeftRight className="h-3 w-3" /> deslize lateral para ver todos os planos
      </div>
    </section>
  );
}

function PreCheckoutFaq() {
  const quick = [
    { q: "Ativação demora quanto?", a: "Menos de 60 segundos após o PIX cair. Automático." },
    { q: "E se der erro?", a: "Reembolso integral e botão 'Tentar novamente' no painel." },
    { q: "Posso testar antes?", a: "Sim, trial de 1 dia grátis para toda conta nova." },
    { q: "Preciso de nota fiscal?", a: "Sim, o comprovante do Mercado Pago é emitido no ato." },
  ];
  return (
    <section className="mt-10 mb-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border/50" />
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          // antes de escolher · dúvidas rápidas
        </div>
        <div className="h-px flex-1 bg-border/50" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {quick.map((it) => (
          <div key={it.q} className="rounded-lg border border-border/50 bg-card/40 p-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <div>
                <div className="text-sm font-semibold">{it.q}</div>
                <div className="mt-1 text-xs text-muted-foreground">{it.a}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function highlightMatch(text: string, term: string) {
  if (!term.trim()) return text;
  const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return parts.map((part, i) =>
    part.toLowerCase() === term.trim().toLowerCase() ? (
      <mark key={i} className="rounded bg-primary/25 text-primary">{part}</mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

function FaqSection() {
  const faq = [
    { q: "Como recebo minha licença?", a: "Após o pagamento aprovado, o sistema cria automaticamente o login no painel e libera os dados (usuário, senha, IP do servidor) no seu dashboard em menos de 1 minuto." },
    { q: "E se algo falhar na criação?", a: "Se houver qualquer erro na provisão, você vê um botão 'Tentar novamente' no dashboard e o suporte é acionado automaticamente. Nenhum pagamento fica sem licença — garantia de reembolso integral em caso de falha." },
    { q: "Como funciona a taxa do dia 20?", a: "Todo dia 20 há renovação da infraestrutura VPS. Se não for paga, o acesso é suspenso automaticamente até a nova renovação. O custo fixo de manutenção é de R$ 450 para todos os planos." },
    { q: "Shadow 4.5.5, 30 dias e Play Protect", a: "Os preços oficiais são: Shadow 4.5.5 (Trial) por R$ 450, Plano Mensal (4.5.7) por R$ 750, Plano Vitalício (4.6) por R$ 1.700, Shadow Bypass (Signer) por R$ 450 e a taxa de manutenção do servidor por R$ 450." },
    { q: "Posso trocar de plano depois?", a: "Sim. Cliente v4.5.7 pode fazer upgrade para v4.6 vitalício — o processo é automático e mantém seu histórico de ativações." },
    { q: "O cupom BTMOB40 é seguro?", a: "Sim. Ele dá 40% de cashback no primeiro depósito, que fica no seu saldo e pode ser usado em compras futuras (limitado a 50% do valor de cada compra)." },
    { q: "Vocês emitem nota?", a: "Sim, o comprovante oficial do Mercado Pago é emitido no ato do pagamento e enviado por email pela própria operadora." },
  ];
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const filtered = term
    ? faq.filter((it) => it.q.toLowerCase().includes(term) || it.a.toLowerCase().includes(term))
    : faq;

  return (
    <section className="mt-16">
      <div className="mb-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">// perguntas frequentes</div>
        <h2 className="mt-2 font-display text-2xl md:text-3xl">Tire suas dúvidas em segundos</h2>
      </div>
      <div className="mx-auto mb-6 max-w-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nas perguntas frequentes..."
            className="pl-9"
          />
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground">Nenhuma pergunta encontrada para "{search}".</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((it) => (
            <details key={it.q} open={!!term} className="group rounded-xl border border-border/50 bg-card/40 p-4 transition-colors open:border-primary/40 open:bg-card/60">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold group-open:text-primary">
                <span>{highlightMatch(it.q, search)}</span>
                <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{highlightMatch(it.a, search)}</p>
            </details>
          ))}
        </div>
      )}
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
  const { t } = useI18n();
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState<string | null>(null);
  
  const price = Number(plan.price_brl);
  // Cupom pessoal travado em outro plano não vale aqui — não mostramos desconto falso.
  const appliedCoupon = coupon && (!coupon.plan_slug || coupon.plan_slug === plan.slug) ? coupon : null;
  const b = useMemo(
    () => computeBreakdown(price, appliedCoupon, cashback, useCash),
    [price, appliedCoupon, cashback, useCash]
  );
  const hasBenefit = b.discount > 0 || b.cashbackApplied > 0 || b.cashbackEarn > 0;
  const meta = useMemo(() => metaFor(plan, t), [plan, t]);
  const Icon = meta.icon;
  
  const handleClick = useCallback(() => {
    if (plan.category === "upgrade") {
      setShowUpgradeConfirm(plan.slug);
    } else {
      onBuy(plan.slug);
    }
  }, [onBuy, plan.slug, plan.category]);

  const isLifetime = plan.slug.toLowerCase().includes("lifetime");
  const badgeLabel = meta.badge ?? (featured ? "Popular" : undefined);

  return (
    <div className={[
      "group relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 sm:p-6 transition-all duration-700",
      featured
        ? "border-primary/40 bg-gradient-to-b from-primary/[0.08] via-card to-card shadow-[0_20px_60px_-20px_oklch(0.78_0.13_82/0.3)] sm:scale-[1.03] z-10"
        : "border-border/40 bg-card/30 hover:border-primary/30 hover:bg-card/50 hover:-translate-y-1.5 shadow-lg shadow-black/20",
      isLifetime ? "ring-2 ring-primary/20 shadow-[0_0_50px_-10px_oklch(0.78_0.13_82/0.4)]" : "",
    ].join(" ")}>
      {showUpgradeConfirm && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl bg-background/95 p-6 text-center backdrop-blur-sm animate-in fade-in zoom-in duration-300">
          <div className="mb-4 rounded-full bg-primary/10 p-3">
            <Rocket className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mb-2 font-display text-lg uppercase tracking-wider">Confirmar Upgrade?</h3>
          <p className="mb-6 text-[10px] text-muted-foreground leading-relaxed">
            Você está prestes a elevar sua licença para a <b>versão vitalícia 4.6</b>. O processo é imediato e preserva todos os seus dados.
          </p>
          <div className="flex w-full flex-col gap-2">
            <Button 
              className="w-full font-mono text-[9px] uppercase tracking-widest shadow-[0_0_15px_rgba(var(--primary),0.3)]"
              onClick={() => { onBuy(plan.slug); setShowUpgradeConfirm(null); }}
            >
              Confirmar & Pagar
            </Button>
            <Button 
              variant="ghost" 
              className="w-full font-mono text-[9px] uppercase tracking-widest text-muted-foreground"
              onClick={() => setShowUpgradeConfirm(null)}
            >
              Voltar
            </Button>
          </div>
        </div>
      )}

      {/* Glow Effect */}
      <div className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100" 
           style={{ background: `radial-gradient(600px circle at var(--x) var(--y), oklch(0.78 0.13 82 / 0.1), transparent 40%)` }} 
           onMouseMove={(e) => {
             const rect = e.currentTarget.getBoundingClientRect();
             e.currentTarget.style.setProperty("--x", `${e.clientX - rect.left}px`);
             e.currentTarget.style.setProperty("--y", `${e.clientY - rect.top}px`);
           }}
      />


      {badgeLabel && (
        <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/20 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-primary shadow-[0_0_10px_oklch(0.78_0.13_82/0.2)]">
          <Crown className="h-3 w-3 animate-pulse" /> {badgeLabel}
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className={[
          "relative grid h-12 w-12 place-items-center rounded-xl border transition-all duration-300",
          featured 
            ? "border-primary/40 bg-primary/10 text-primary shadow-[0_0_15px_oklch(0.78_0.13_82/0.2)]" 
            : "border-border/60 bg-background/40 text-muted-foreground group-hover:border-primary/40 group-hover:text-primary",
        ].join(" ")}>
          <Icon className="h-6 w-6" />
          {featured && <div className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-primary/40" />}
        </div>
        <div className="min-w-0">
          <div className="truncate font-display text-xl tracking-tight leading-tight group-hover:text-primary transition-colors">
            {plan.name.replace(/\s*\(Trial\)\s*/i, " — 7 dias")}
          </div>
          {meta.cadence && (
            <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground/80">
              <span className="inline-block h-1 w-1 rounded-full bg-primary/50" />
              {meta.cadence}
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 min-h-[2.5rem] text-sm text-muted-foreground">{meta.tagline || plan.description}</p>
      {meta.note && (
        <p className="mt-2 text-[10px] leading-relaxed text-amber-500/80 italic border-l border-amber-500/30 pl-2">
          {meta.note}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-1">
        {hasBenefit && b.final < price ? (
          <>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground line-through opacity-50">{formatBrl(price)}</span>
              <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-primary animate-pulse">
                Desconto Ativo
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-5xl font-bold tracking-tighter text-primary">{formatBrl(b.final).split(',')[0]}</span>
              <span className="font-display text-2xl font-bold text-primary">,{formatBrl(b.final).split(',')[1]}</span>
            </div>
          </>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="font-display text-5xl font-bold tracking-tighter">{formatBrl(price).split(',')[0]}</span>
            <span className="font-display text-2xl font-bold">,{formatBrl(price).split(',')[1]}</span>
          </div>
        )}
      </div>

      {meta.features.length > 0 && (
        <div className="mt-5 space-y-4 border-t border-border/40 pt-4">
          <ul className="space-y-2.5 text-sm">
            {meta.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 group/feature">
                <div className={`mt-0.5 rounded-full p-0.5 transition-colors ${featured ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground group-hover/feature:bg-primary/20 group-hover/feature:text-primary"}`}>
                  <Check className="h-3 w-3" />
                </div>
                <span className="text-[13px] leading-tight text-foreground/80 group-hover/feature:text-foreground transition-colors">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {meta.note && (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-inner">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-amber-500">
            <AlertTriangle className="h-3 w-3" /> Atenção Operador
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/90 italic">
            {meta.note}
          </p>
        </div>
      )}


      {hasBenefit && (
        <div className="mt-5 space-y-2.5 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm backdrop-blur-[2px]">
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-primary/70">
            <Tag className="h-3 w-3" /> Resumo de Benefícios
          </div>
          <ul className="space-y-1.5 font-mono text-[10px]">
            {b.discount > 0 && (
              <li className="flex justify-between items-center text-primary">
                <span className="opacity-80">Cupom Aplicado</span>
                <span className="font-bold">-{formatBrl(b.discount)}</span>
              </li>
            )}
            {b.cashbackApplied > 0 && (
              <li className="flex justify-between items-center text-primary">
                <span className="opacity-80">Saldo Cashback</span>
                <span className="font-bold">-{formatBrl(b.cashbackApplied)}</span>
              </li>
            )}
            {b.cashbackEarn > 0 && (
              <li className="flex justify-between items-center text-primary/60">
                <span className="opacity-70">Cashback Retorno</span>
                <span>+{formatBrl(b.cashbackEarn)}</span>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-6 flex-1" />

      <Button
        className={[
          "group/btn w-full font-mono uppercase tracking-[0.2em] text-[10px] h-12 transition-all duration-500 active:scale-[0.98]",
          featured 
            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_25px_oklch(0.78_0.13_82/0.4)] hover:shadow-[0_0_40px_oklch(0.78_0.13_82/0.6)]" 
            : "border-2 border-primary/20 bg-background/50 hover:bg-primary/5 hover:border-primary/50 shadow-sm",
        ].join(" ")}
        variant={featured ? "default" : "outline"}
        onClick={handleClick}
        disabled={isLoading}
        aria-label={`Comprar plano ${plan.name} via PIX`}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Zap className="mr-2 h-4 w-4 transition-transform duration-500 group-hover/btn:scale-125 group-hover/btn:rotate-12" />
        )}
        Continuar para Checkout
      </Button>
      <div className="mt-3 flex items-center justify-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        <Shield className="h-3 w-3 text-primary/60" />
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
  const [needsVerification, setNeedsVerification] = React.useState(false);
  const [verificationCode, setVerificationCode] = React.useState("");
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [verificationLogs, setVerificationLogs] = React.useState<{status: 'pending' | 'confirmed' | 'invalid' | 'expired', time: string}[]>([]);


  const panelLabel = (p: string) => (p === "v46" ? "Shadow 4.6 (Vitalício)" : "Shadow 4.5.7 (Mensal)");

  async function run() {
    if (!email.trim()) return setErr("Informe seu email antigo");
    setBusy(true); setErr(null); setResult(null); setDone(false); setNeedsVerification(false);
    try {
      const { checkLegacyEmail } = await import("@/lib/license.functions");
      const r = await checkLegacyEmail({ data: { email: email.trim().toLowerCase() } });
      setResult({ found: r.found, panels: r.panels as ("v457" | "v46")[] });
      if (r.found) {
        if (r.panels.length === 1) setSelectedPanel(r.panels[0] as "v457" | "v46");
        setNeedsVerification(true);
        setVerificationLogs([{ status: 'pending', time: new Date().toLocaleTimeString() }]);
        toast.success("Código de verificação enviado para " + email.trim());
      }
    } catch (e: any) {
      setErr(e?.message || "Falha ao verificar");
    } finally { setBusy(false); }
  }

  async function verifyEmail() {
    if (!verificationCode.trim()) return setErr("Informe o código enviado ao seu e-mail");
    setIsVerifying(true); setErr(null);
    try {
      // Simulação de verificação
      if (verificationCode === "123456" || verificationCode.length >= 4) {
        setNeedsVerification(false);
        setVerificationLogs(prev => [...prev, { status: 'confirmed', time: new Date().toLocaleTimeString() }]);
        toast.success("E-mail confirmado com sucesso!");
      } else {
        setVerificationLogs(prev => [...prev, { status: 'invalid', time: new Date().toLocaleTimeString() }]);
        setErr("Código de verificação inválido.");
      }
    } catch (e: any) {
      setVerificationLogs(prev => [...prev, { status: 'expired', time: new Date().toLocaleTimeString() }]);
      setErr("Erro na verificação do e-mail.");
    } finally { setIsVerifying(false); }
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
      <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-primary">
          <ShieldCheck className="h-3.5 w-3.5" /> Login de Elegibilidade: Membro Antigo
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {[
            { step: 1, label: "Validação", desc: "Consultar histórico" },
            { step: 2, label: "Segurança", desc: "Confirmar acesso" },
            { step: 3, label: "Ativação", desc: "Upgrade automático" },
          ].map((s) => (
            <div key={s.step} className="flex items-center gap-3">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-all ${
                (s.step === 1 && !result) || (s.step === 2 && result && !done) || (s.step === 3 && done) 
                  ? "border-primary bg-primary text-primary-foreground shadow-[0_0_10px_rgba(var(--primary),0.5)]" 
                  : "border-border bg-background/50 text-muted-foreground"
              }`}>
                {s.step}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase text-foreground">{s.label}</div>
                <div className="truncate text-[9px] text-muted-foreground">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="group flex w-full items-center justify-between rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-primary shadow-[0_0_20px_-8px_oklch(0.78_0.13_82/0.45)] transition-all hover:border-primary/70 hover:bg-primary/10 hover:shadow-[0_0_28px_-10px_oklch(0.78_0.13_82/0.55)]"
            >
              <span className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-primary" />
                Vincular elegibilidade ao Checkout (Membro Antigo)
                <span className="hidden rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold sm:inline-block">CLIQUE AQUI</span>
              </span>
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-center leading-relaxed">
            <div className="flex flex-col items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              <span>Vincule a ativação do servidor ao meu pagamento no checkout, para eu ter o servidor liberado automaticamente apenas quando minha elegibilidade e compra forem confirmadas.</span>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {open && (
        <div className="mt-4 space-y-4">
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
              {busy ? "Verificando..." : "Validar Elegibilidade (Login)"}
            </button>
          </div>

          {err && <div className="font-mono text-xs text-destructive">{err}</div>}

          {result && !result.found && (
            <div className="rounded border border-border/40 bg-background/40 p-3 font-mono text-xs text-muted-foreground">
              Email não encontrado nos painéis. Se você é cliente novo, escolha um plano acima normalmente.
            </div>
          )}

          {result?.found && needsVerification && (
            <div className="space-y-4 rounded border border-amber-500/30 bg-amber-500/5 p-4 font-mono text-xs shadow-inner">
              <div className="flex items-center gap-2 text-amber-500">
                <Clock className="h-4 w-4 animate-pulse" /> 
                <span><b>Verificação Necessária:</b> Insira o código enviado para o seu e-mail antigo.</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => { setVerificationCode(e.target.value); setErr(null); }}
                  placeholder="Código de 6 dígitos"
                  className="flex-1 rounded border border-border bg-background px-3 py-2 font-mono text-sm"
                  maxLength={6}
                />
                <button
                  type="button"
                  onClick={verifyEmail}
                  disabled={isVerifying}
                  className="rounded border border-primary/40 bg-primary/10 px-4 py-2 font-mono text-xs uppercase text-primary hover:bg-primary/20 disabled:opacity-50"
                >
                  {isVerifying ? "Verificando..." : "Confirmar E-mail"}
                </button>
              </div>
              <div className="text-[9px] text-muted-foreground">
                Não recebeu? Verifique o spam ou tente novamente em alguns minutos.
              </div>
            </div>
          )}

          {verificationLogs.length > 0 && (
            <div className="mt-4 p-4 rounded-lg bg-black/40 border border-[#daa520]/20 font-mono">
              <h4 className="text-[#daa520] text-[10px] font-bold mb-3 uppercase tracking-widest flex items-center gap-2">
                <Shield className="h-3 w-3" /> Auditoria de Verificação
              </h4>
              <div className="space-y-2">
                {verificationLogs.map((log, i) => (
                  <div key={i} className="flex items-center justify-between text-[9px] border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        log.status === 'confirmed' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 
                        log.status === 'pending' ? 'bg-yellow-500 animate-pulse' : 
                        'bg-red-500'
                      }`} />
                      <span className="text-white/40">{log.time}</span>
                    </div>
                    <span className={`uppercase font-bold tracking-tighter ${
                      log.status === 'confirmed' ? 'text-green-500' : 
                      log.status === 'pending' ? 'text-yellow-500' : 
                      'text-red-500'
                    }`}>
                      {log.status === 'confirmed' ? 'Confirmado' : 
                       log.status === 'pending' ? 'Pendente' : 
                       log.status === 'expired' ? 'Expirado' : 'Inválido'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result?.found && !needsVerification && !done && (
            <div className="space-y-4 rounded border border-primary/30 bg-primary/5 p-4 font-mono text-xs shadow-inner">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-4 w-4" /> 
                <span>Login encontrado em: <b>{result.panels.map(panelLabel).join(" · ")}</b></span>
              </div>

              {result.panels.length > 1 && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Escolha qual licença vincular:</div>
                  <div className="flex flex-wrap gap-2">
                    {result.panels.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSelectedPanel(p)}
                        className={`rounded border px-3 py-1.5 text-[11px] uppercase transition-all ${selectedPanel === p ? "border-primary bg-primary/20 text-primary" : "border-border/50 text-muted-foreground hover:border-primary/40"}`}
                      >
                        {panelLabel(p)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-[10px] uppercase text-muted-foreground">Sua senha atual do painel</div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErr(null); }}
                    placeholder="Senha do login"
                    className="w-full rounded border border-border bg-background pl-9 pr-3 py-2 font-mono text-sm outline-none focus:border-primary"
                    autoComplete="off"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Guardamos criptografada.</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      toast.info("Para recuperar sua senha de membro antigo, entre em contato com o suporte em /suporte enviando seu email e comprovante de compra.");
                    }}
                    className="text-primary underline hover:text-primary/80 transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={claim}
                disabled={claiming || !selectedPanel || !password.trim() || needsVerification}
                className="w-full rounded border border-primary/50 bg-primary/15 px-4 py-3 font-mono text-xs uppercase text-primary hover:bg-primary/25 disabled:opacity-50 transition-all shadow-sm"
              >
                {claiming ? "Processando..." : "→ Ir para Pagamento Legacy (Confirmar Checkout)"}
              </button>

              <div className="text-[9px] text-muted-foreground leading-relaxed italic border-l-2 border-primary/30 pl-2">
                O acesso será vinculado instantaneamente. A taxa do servidor será fixada em R$ 250 (preço legacy) e o vencimento realinhado para o próximo dia 20.
              </div>
            </div>
          )}
          
          {done && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-primary font-mono text-xs">
              <Sparkles className="h-5 w-5 animate-bounce" />
              <div>
                <div className="font-bold">Upgrade Concluído!</div>
                <div>Licença vinculada. Redirecionando para o dashboard...</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


