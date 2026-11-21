import { getCaktoRenewalCheckout } from "@/lib/cakto-renewal.functions";
import { toast } from "sonner";
import { LIFETIME_PROMOTION_PRICE, useLifetimePromotion } from "@/components/LifetimePromotionBanner";
import { getLifetimePromotionLink } from "@/lib/lifetime-promotion.functions";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { listMyOrders } from "@/lib/orders.functions";
import { saveCheckoutProfile } from "@/lib/checkout-profile.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { cn } from "@/lib/utils";

const CAKTO_OFFERS = {
  "login-30d": {
    url: "https://pay.cakto.com.br/haxjxbp_1331078",
    amount: 750,
    label: "Assinatura mensal",
    cadence: "/mês",
  },
  "login-lifetime": {
    url: "https://pay.cakto.com.br/339nu9w_1331894",
    amount: 1700,
    label: "Plano Vitalício",
    cadence: "",
  },
} as const;

export const Route = createFileRoute("/pagamento/checkout")({
  validateSearch: (search: Record<string, unknown>): { order?: string } => ({
    order: typeof search.order === "string" ? search.order : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Pagamento seguro — Shadow" },
      {
        name: "description",
        content:
          "Pague seu plano Shadow pela Cakto. A equipe entrega a licença após confirmar o pagamento.",
      },
      { property: "og:title", content: "Pagamento seguro — Shadow" },
      { property: "og:description", content: "Pague seu plano Shadow no checkout da Cakto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

type Survey = {
  fullName: string;
  contact: string;
  firstTime: "sim" | "nao" | "";
  referred: "sim" | "nao" | "";
  referrer: string;
  source: string;
  consent: boolean;
};

const EMPTY: Survey = {
  fullName: "",
  contact: "",
  firstTime: "",
  referred: "",
  referrer: "",
  source: "",
  consent: false,
};

const SOURCES = ["Telegram", "Indicação de amigo", "Instagram / TikTok", "Google", "YouTube", "Outro"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function contactKind(v: string): "email" | "phone" | null {
  const clean = v.trim();
  if (EMAIL_RE.test(clean)) return "email";
  const digits = clean.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 13) return "phone";
  return null;
}

function validate(s: Survey): Partial<Record<keyof Survey, string>> {
  const e: Partial<Record<keyof Survey, string>> = {};
  const name = s.fullName.trim();
  if (name.length < 3) e.fullName = "Informe seu nome completo (mínimo 3 letras).";
  else if (!name.includes(" ")) e.fullName = "Informe nome e sobrenome.";
  else if (name.length > 80) e.fullName = "Nome muito longo.";

  if (!s.contact.trim()) e.contact = "Informe um e-mail ou telefone para contato.";
  else if (!contactKind(s.contact)) e.contact = "E-mail inválido ou telefone com DDD incompleto.";

  if (!s.firstTime) e.firstTime = "Escolha uma opção.";
  if (!s.referred) e.referred = "Escolha uma opção.";
  else if (s.referred === "sim" && s.referrer.trim().length < 2)
    e.referrer = "Diga quem te indicou (apelido, @user ou código).";

  if (!s.consent) e.consent = "É necessário aceitar o uso dos dados para continuar.";
  return e;
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CheckoutPage() {
  const { order } = Route.useSearch();
  const storageKey = order ? `shadow:checkout-survey:${order}` : "";

  const [survey, setSurvey] = useState<Survey>(EMPTY);
  const [confirmed, setConfirmed] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { data: orders } = useQuery({
    queryKey: ["my-orders-checkout"],
    queryFn: () => listMyOrders({ data: {} }),
    staleTime: 60 * 1000,
  });

  const current = useMemo(() => orders?.find((o) => o.id === order) ?? null, [orders, order]);
  const caktoOffer =
    current?.plan_slug === "login-30d" || current?.plan_slug === "login-lifetime"
      ? CAKTO_OFFERS[current.plan_slug]
      : null;
  const isServerRenewal = current?.plan_slug === "server-monthly" || current?.plan_slug === "server-monthly-legacy";
  const { data: renewalOffer, isError: renewalError, refetch: retryRenewal } = useQuery({
    queryKey: ["cakto-renewal", current?.id],
    queryFn: () => getCaktoRenewalCheckout({ data: { orderId: current!.id, open: false } }),
    enabled: isServerRenewal,
  });
  const availableCaktoOffer =
    current && caktoOffer && current.amount === caktoOffer.amount &&
    ["created", "pending"].includes(current.status)
      ? caktoOffer
      : isServerRenewal ? renewalOffer ?? null : null;
  const { active: promotionActive } = useLifetimePromotion(current?.plan_slug === "login-lifetime");
  const promotionalCheckout = promotionActive && availableCaktoOffer === CAKTO_OFFERS["login-lifetime"];
  const [openingPromotion, setOpeningPromotion] = useState(false);

  async function openSpecialCaktoCheckout() {
    setOpeningPromotion(true);
    try {
      const url = isServerRenewal && current
        ? (await getCaktoRenewalCheckout({ data: { orderId: current.id, open: true } }))?.url
        : await getLifetimePromotionLink();
      if (!url) {
        toast.info(isServerRenewal
          ? "Este pedido deixou de ser elegível para renovação pela Cakto."
          : "A promoção acabou. Confira o valor atualizado antes de continuar.");
        return;
      }
      window.location.assign(url);
    } catch {
      toast.error("Não foi possível abrir a oferta. Tente novamente.");
    } finally {
      setOpeningPromotion(false);
    }
  }

  const errors = validate(survey);
  const set = (patch: Partial<Survey>) => setSurvey((s) => ({ ...s, ...patch }));

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setSurvey({ ...EMPTY, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  async function confirmSurvey() {
    setTouched(true);
    setSaveError(null);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const res: any = await saveCheckoutProfile({
        data: {
          orderId: order!,
          fullName: survey.fullName.trim(),
          contact: survey.contact.trim(),
          contactKind: contactKind(survey.contact)!,
          firstTime: survey.firstTime as "sim" | "nao",
          referred: survey.referred as "sim" | "nao",
          referrer: survey.referrer.trim(),
          source: survey.source,
          lgpdConsent: true,
        },
      });
      if (!res?.ok) throw new Error(res?.error ?? "Não foi possível salvar seu cadastro.");
      try {
        if (storageKey) window.localStorage.setItem(storageKey, JSON.stringify(survey));
      } catch {
        /* ignore */
      }
      setConfirmed(true);
    } catch (e) {
      setSaveError((e as Error)?.message ?? "Falha ao salvar o cadastro.");
    }
    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-background">
      <PaymentTestModeBanner anyProviderActive={false} />

      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <Link
          to="/planos"
          className="mb-6 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar aos planos
        </Link>

        <header className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight">Pagamento seguro</h1>
          <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-neon" /> Processado pelo provedor de pagamento — o Shadow nunca
            guarda dados do seu cartão.
          </p>
        </header>

        {!order ? (
          <div className="rounded-xl border border-danger/40 bg-danger/5 p-4">
            <p className="flex items-center gap-2 font-mono text-xs text-danger">
              <AlertTriangle className="h-4 w-4" /> Pedido não encontrado. Volte e escolha o plano novamente.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              {/* Passo 1 — cadastro */}
              <section className="rounded-xl border border-border bg-card/60 p-4 sm:p-5">
                <StepHeader
                  n={1}
                  title="Cadastro rápido"
                  subtitle="Leva 30 segundos e garante o envio dos dados de acesso após a compra."
                  done={confirmed}
                />

                {confirmed ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Chip>{survey.fullName}</Chip>
                    <Chip>{survey.contact}</Chip>
                    <Chip>{survey.firstTime === "sim" ? "Primeira compra" : "Já é cliente"}</Chip>
                    <Chip>{survey.referred === "sim" ? `Indicado por ${survey.referrer}` : "Sem indicação"}</Chip>
                    {survey.source && <Chip>{survey.source}</Chip>}
                    <button
                      type="button"
                      onClick={() => setConfirmed(false)}
                      className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      editar
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <Field label="Nome completo" required error={touched ? errors.fullName : undefined}>
                      <input
                        value={survey.fullName}
                        onChange={(e) => set({ fullName: e.target.value })}
                        placeholder="Ex: João da Silva"
                        maxLength={80}
                        aria-invalid={Boolean(touched && errors.fullName)}
                        className={inputCls(Boolean(touched && errors.fullName))}
                      />
                    </Field>

                    <Field
                      label="E-mail ou telefone (WhatsApp)"
                      required
                      error={touched ? errors.contact : undefined}
                    >
                      <input
                        value={survey.contact}
                        onChange={(e) => set({ contact: e.target.value })}
                        placeholder="voce@email.com ou (11) 90000-0000"
                        maxLength={120}
                        aria-invalid={Boolean(touched && errors.contact)}
                        className={inputCls(Boolean(touched && errors.contact))}
                      />
                    </Field>

                    <Field label="É sua primeira compra no Shadow?" required error={touched ? errors.firstTime : undefined}>
                      <div className="flex gap-2">
                        <Toggle active={survey.firstTime === "sim"} onClick={() => set({ firstTime: "sim" })}>
                          Sim, é a primeira
                        </Toggle>
                        <Toggle active={survey.firstTime === "nao"} onClick={() => set({ firstTime: "nao" })}>
                          Já sou cliente
                        </Toggle>
                      </div>
                    </Field>

                    <Field
                      label="Alguém te indicou?"
                      required
                      error={touched ? errors.referred ?? errors.referrer : undefined}
                    >
                      <div className="flex gap-2">
                        <Toggle active={survey.referred === "sim"} onClick={() => set({ referred: "sim" })}>
                          Sim
                        </Toggle>
                        <Toggle active={survey.referred === "nao"} onClick={() => set({ referred: "nao", referrer: "" })}>
                          Não
                        </Toggle>
                      </div>
                      {survey.referred === "sim" && (
                        <input
                          value={survey.referrer}
                          onChange={(e) => set({ referrer: e.target.value })}
                          placeholder="Apelido, @user do Telegram ou código de indicação"
                          maxLength={60}
                          className={cn("mt-2", inputCls(Boolean(touched && errors.referrer)))}
                        />
                      )}
                    </Field>

                    <Field label="Como você conheceu o Shadow?">
                      <div className="flex flex-wrap gap-2">
                        {SOURCES.map((s) => (
                          <Toggle key={s} active={survey.source === s} onClick={() => set({ source: s })}>
                            {s}
                          </Toggle>
                        ))}
                      </div>
                    </Field>

                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background/50 p-3">
                      <input
                        type="checkbox"
                        checked={survey.consent}
                        onChange={(e) => set({ consent: e.target.checked })}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--neon,#22c55e)]"
                      />
                      <span className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                        Autorizo o Shadow a tratar meus dados (nome e contato) para processar esta compra, enviar os
                        dados de acesso e prestar suporte, conforme a{" "}
                        <Link to="/privacidade" className="text-neon underline underline-offset-2">
                          Política de Privacidade
                        </Link>{" "}
                        e a LGPD (Lei 13.709/2018). Posso pedir exclusão a qualquer momento pelo suporte.
                      </span>
                    </label>
                    {touched && errors.consent && (
                      <p className="flex items-center gap-1.5 font-mono text-[11px] text-danger">
                        <AlertTriangle className="h-3.5 w-3.5" /> {errors.consent}
                      </p>
                    )}

                    {saveError && (
                      <p className="flex items-center gap-1.5 font-mono text-[11px] text-danger">
                        <AlertTriangle className="h-3.5 w-3.5" /> {saveError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={confirmSurvey}
                      disabled={saving}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-neon px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-background transition hover:opacity-90 disabled:opacity-60 sm:w-auto"
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                      Continuar para o pagamento
                    </button>
                  </div>
                )}
              </section>

              {/* Passo 2 — pagamento */}
              <section className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
                <StepHeader n={2} title="Como você quer pagar?" subtitle="Escolha o meio de pagamento." />

                {isServerRenewal && renewalOffer === null && !renewalError && (
                  <div className="mt-4 rounded-lg border border-border p-3 text-sm text-muted-foreground">
                    A Cakto não está disponível para este pedido. Se ele foi aberto com um valor antigo,
                    <Link to="/renovar-servidor" className="ml-1 font-semibold text-foreground underline">
                      volte à renovação e selecione o login novamente
                    </Link>.
                  </div>
                )}
                {renewalError && (
                  <div role="alert" className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    Não foi possível verificar a renovação pela Cakto.
                    <button type="button" className="font-semibold underline" onClick={() => void retryRenewal()}>
                      Tentar novamente
                    </button>
                  </div>
                )}
                <div className={cn("mt-4 grid gap-3", availableCaktoOffer && "sm:grid-cols-2")}>
                  {availableCaktoOffer && (
                    <div className="flex flex-col rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4">
                      <div className="flex items-center gap-3">
                        <div className="grid size-14 shrink-0 place-items-center rounded-xl border border-emerald-500/15 bg-background">
                          <img src="/assets/cakto-brand.svg" alt="" width={36} height={36} className="size-9" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">Cakto</p>
                          <p className="text-xs text-muted-foreground">{availableCaktoOffer.label}</p>
                        </div>
                      </div>
                      <p className="mt-4 text-xl font-bold tracking-tight text-foreground">
                        {promotionalCheckout && (
                          <s className="mr-2 text-sm font-medium text-muted-foreground">{brl(availableCaktoOffer.amount)}</s>
                        )}
                        {brl(promotionalCheckout ? LIFETIME_PROMOTION_PRICE : availableCaktoOffer.amount)}
                        {availableCaktoOffer.cadence && (
                          <span className="ml-1 text-sm font-medium text-muted-foreground">{availableCaktoOffer.cadence}</span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isServerRenewal ? "Renovação do login selecionado pelo suporte." : "Licença entregue pelo suporte."}
                      </p>
                      <AlertDialog key={promotionalCheckout ? "promotion" : "standard"}>
                        <AlertDialogTrigger asChild>
                          <button
                            type="button"
                            disabled={!confirmed}
                            className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <ExternalLink className="size-4" aria-hidden="true" />
                            Pagar com Cakto
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{isServerRenewal ? "Atenção à renovação do servidor" : "Atenção à entrega da licença"}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {isServerRenewal ? (
                                <>A Cakto cobra a cada 30 dias. A renovação do seu login é manual. A cada pagamento, abra
                                um ticket no suporte e envie o comprovante e o número do pedido <strong>#{order.slice(0, 8)}</strong>.</>
                              ) : (
                                <>A entrega da licença é manual. Depois de pagar pela Cakto, abra um ticket no suporte e
                                envie o comprovante e o número do pedido <strong>#{order.slice(0, 8)}</strong>.</>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                            {promotionalCheckout || isServerRenewal ? (
                              <AlertDialogAction
                                disabled={openingPromotion}
                                onClick={(event) => {
                                  event.preventDefault();
                                  void openSpecialCaktoCheckout();
                                }}
                              >
                                {openingPromotion ? "Abrindo Cakto…" : promotionalCheckout ? `Continuar para a Cakto · ${brl(LIFETIME_PROMOTION_PRICE)}` : "Continuar para a Cakto"}
                              </AlertDialogAction>
                            ) : (
                              <AlertDialogAction asChild>
                                <a href={availableCaktoOffer.url ?? undefined}>Continuar para a Cakto</a>
                              </AlertDialogAction>
                            )}
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {!confirmed && (
                        <p className="mt-2 text-xs text-muted-foreground">Conclua o cadastro acima para pagar.</p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col rounded-xl border border-border bg-muted/25 p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative grid h-14 w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
                        <img src="/assets/logo-mercadopago-maintenance.png" alt="" width={88} height={88} className="size-[88px] max-w-none" />
                        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-amber-400 py-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-black">
                          Manutenção
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">Mercado Pago</p>
                    </div>
                    <p className="mb-4 mt-4 text-sm text-muted-foreground">Pagamento temporariamente indisponível.</p>
                    <button
                      type="button"
                      disabled
                      className="mt-auto min-h-10 w-full cursor-not-allowed rounded-lg border border-border bg-background/60 px-3 py-2.5 text-sm font-medium text-muted-foreground"
                    >
                      Indisponível
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-xl border border-border bg-card/60 p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Resumo do pedido</p>
                <p className="mt-2 font-display text-lg font-bold">
                  {current?.plan_name ?? current?.plan_slug ?? "Plano Shadow"}
                </p>
                {current && (
                  <p className="mt-1 font-mono text-2xl font-bold text-neon">
                    {brl(promotionalCheckout ? LIFETIME_PROMOTION_PRICE : current.amount)}
                  </p>
                )}
                {promotionalCheckout && (
                  <p className="mt-1 text-xs text-muted-foreground">Valor promocional no checkout da Cakto.</p>
                )}
                <p className="mt-3 font-mono text-[10px] text-muted-foreground">Pedido #{order.slice(0, 8)}</p>
              </div>

              <ul className="space-y-2.5 rounded-xl border border-border bg-card/40 p-4">
                <Perk icon={Zap}>{isServerRenewal ? "Renovação manual após confirmação do pagamento" : "Entrega manual da licença após confirmação do pagamento"}</Perk>
                <Perk icon={BadgeCheck}>{isServerRenewal ? "Você mantém o login selecionado" : "A equipe informa os dados de acesso após a confirmação"}</Perk>
                <Perk icon={ShieldCheck}>Ambiente seguro — não guardamos dados de cartão</Perk>
                <Perk icon={Sparkles}>Suporte humano no Telegram 7 dias por semana</Perk>
              </ul>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function inputCls(invalid: boolean) {
  return cn(
    "w-full rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none transition",
    invalid ? "border-danger focus:border-danger" : "border-border focus:border-neon",
  );
}

function StepHeader({ n, title, subtitle, done }: { n: number; title: string; subtitle: string; done?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]",
          done ? "border-neon bg-neon/15 text-neon" : "border-border text-muted-foreground",
        )}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
      </span>
      <div>
        <h2 className="font-display text-base font-bold tracking-tight">{title}</h2>
        <p className="font-mono text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-neon">*</span>}
      </p>
      {children}
      {error && (
        <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-danger">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
    </div>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-3 py-1.5 font-mono text-[11px] transition",
        active
          ? "border-neon bg-neon/10 text-neon"
          : "border-border bg-background text-muted-foreground hover:border-muted-foreground/50",
      )}
    >
      {children}
    </button>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-border bg-muted/20 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </span>
  );
}

function Perk({ icon: Icon, children }: { icon: typeof Zap; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon" />
      <span>{children}</span>
    </li>
  );
}
