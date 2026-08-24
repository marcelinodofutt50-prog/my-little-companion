import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { createMercadoPagoCheckout, getPaymentProviders } from "@/lib/mercadopago.functions";
import { listMyOrders } from "@/lib/orders.functions";
import { saveCheckoutProfile } from "@/lib/checkout-profile.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { cn } from "@/lib/utils";
import mercadoPagoLogo from "@/assets/logo-mercadopago.svg";
import stripeLogo from "@/assets/logo-stripe.svg";

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
          "Finalize sua compra Shadow com pagamento seguro por Pix, cartão ou boleto. Liberação automática da licença após a aprovação.",
      },
      { property: "og:title", content: "Pagamento seguro — Shadow" },
      { property: "og:description", content: "Finalize sua compra Shadow com pagamento seguro, sem sair do site." },
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
  const [mpLoading, setMpLoading] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);

  const { data: providers, isLoading: loadingProviders } = useQuery({
    queryKey: ["payment-providers"],
    queryFn: () => getPaymentProviders(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: orders } = useQuery({
    queryKey: ["my-orders-checkout"],
    queryFn: () => listMyOrders({ data: {} }),
    staleTime: 60 * 1000,
  });

  const current = useMemo(() => orders?.find((o) => o.id === order) ?? null, [orders, order]);
  const mpOn = Boolean(providers?.mercadopago);
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

  async function payWithMercadoPago() {
    if (!order || !confirmed) return;
    setMpLoading(true);
    setMpError(null);
    try {
      const res = await createMercadoPagoCheckout({ data: { orderId: order, returnOrigin: window.location.origin } });
      if ("error" in res) throw new Error(res.error);
      window.location.href = res.url;
    } catch (e) {
      setMpError((e as Error)?.message ?? "Não foi possível abrir o Mercado Pago.");
      setMpLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <PaymentTestModeBanner anyProviderActive={mpOn} />

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
              <section
                className={cn(
                  "rounded-xl border border-border bg-card/60 p-4 transition sm:p-5",
                  !confirmed && "pointer-events-none opacity-50",
                )}
                aria-disabled={!confirmed}
              >
                <StepHeader n={2} title="Como você quer pagar?" subtitle="Escolha o provedor para finalizar a compra." />

                {loadingProviders ? (
                  <p className="mt-4 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando formas de pagamento…
                  </p>
                ) : !mpOn ? (
                  <div className="mt-4 space-y-2 rounded-lg border border-danger/40 bg-danger/5 p-3">
                    <p className="flex items-center gap-2 font-mono text-xs text-danger">
                      <AlertTriangle className="h-4 w-4" /> Pagamentos indisponíveis no momento.
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Seu pedido ({order.slice(0, 8)}) continua salvo. Fale com o suporte no Telegram para concluir a
                      compra — a licença é liberada normalmente.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col rounded-lg border border-neon/50 bg-neon/5 p-4">
                      <div className="flex items-start gap-3">
                        <img
                          src={mercadoPagoLogo}
                          alt="Logo Mercado Pago"
                          className="h-9 w-12 shrink-0 rounded object-contain"
                          loading="lazy"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">Mercado Pago</p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">Pix, cartão ou boleto</p>
                        </div>
                      </div>
                      <span className="mt-3 inline-flex w-fit items-center gap-1 rounded border border-neon/40 bg-neon/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neon">
                        <Zap className="h-3 w-3" /> Pix libera na hora
                      </span>
                      {mpError && (
                        <p className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-danger">
                          <AlertTriangle className="h-3.5 w-3.5" /> {mpError}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={payWithMercadoPago}
                        disabled={mpLoading}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-neon px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-background transition hover:opacity-90 disabled:opacity-60"
                      >
                        {mpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                        {mpLoading ? "Abrindo Mercado Pago…" : "Pagar com Mercado Pago"}
                      </button>
                    </div>

                    <div className="flex flex-col rounded-lg border border-dashed border-border bg-muted/10 p-4">
                      <div className="flex items-start gap-3">
                        <img
                          src={stripeLogo}
                          alt="Logo Stripe"
                          className="h-9 w-12 shrink-0 rounded object-contain opacity-60"
                          loading="lazy"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-muted-foreground">Stripe</p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            Cartão de crédito internacional
                          </p>
                        </div>
                      </div>
                      <span className="mt-3 inline-flex w-fit items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-400">
                        <Clock className="h-3 w-3" /> Em breve
                      </span>
                      <button
                        type="button"
                        disabled
                        className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-border px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground"
                      >
                        <Lock className="h-4 w-4" /> Indisponível
                      </button>
                      <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                        Conta em verificação. Enquanto isso, o cartão também funciona pelo Mercado Pago.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-xl border border-border bg-card/60 p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Resumo do pedido</p>
                <p className="mt-2 font-display text-lg font-bold">
                  {current?.plan_name ?? current?.plan_slug ?? "Plano Shadow"}
                </p>
                {current && <p className="mt-1 font-mono text-2xl font-bold text-neon">{brl(current.amount)}</p>}
                <p className="mt-3 font-mono text-[10px] text-muted-foreground">Pedido #{order.slice(0, 8)}</p>
              </div>

              <ul className="space-y-2.5 rounded-xl border border-border bg-card/40 p-4">
                <Perk icon={Zap}>Licença liberada automaticamente após a aprovação</Perk>
                <Perk icon={BadgeCheck}>Login e senha aparecem no painel em “Licenças”</Perk>
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
