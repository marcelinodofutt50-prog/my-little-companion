import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { AlertTriangle, ArrowLeft, CreditCard, ExternalLink, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { getStripe, getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";
import { createOrderPaymentSession } from "@/lib/payments.functions";
import { createMercadoPagoCheckout, getPaymentProviders } from "@/lib/mercadopago.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pagamento/checkout")({
  validateSearch: (search: Record<string, unknown>): { order?: string } => ({
    order: typeof search.order === "string" ? search.order : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Pagamento seguro — Shadow" },
      { name: "description", content: "Finalize sua compra Shadow com pagamento seguro por cartão, Pix ou Mercado Pago, direto no site." },
      { property: "og:title", content: "Pagamento seguro — Shadow" },
      { property: "og:description", content: "Finalize sua compra Shadow com pagamento seguro, sem sair do site." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

type Provider = "stripe" | "mercadopago";

function CheckoutPage() {
  const { order } = Route.useSearch();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);

  const { data: providers, isLoading: loadingProviders } = useQuery({
    queryKey: ["payment-providers"],
    queryFn: () => getPaymentProviders(),
    staleTime: 5 * 60 * 1000,
  });

  const stripeOn = Boolean(providers?.stripe) && isPaymentsConfigured();
  const mpOn = Boolean(providers?.mercadopago);

  // Se só existe uma forma de pagamento ativa, já abre direto nela.
  useEffect(() => {
    if (provider || loadingProviders) return;
    if (stripeOn && !mpOn) setProvider("stripe");
    else if (mpOn && !stripeOn) setProvider("mercadopago");
  }, [provider, loadingProviders, stripeOn, mpOn]);

  const fetchClientSecret = useCallback(async () => {
    if (!order) throw new Error("Pedido não informado.");
    const res = await createOrderPaymentSession({
      data: {
        orderId: order,
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/pagamento/sucesso?order=${order}`,
      },
    });
    if ("error" in res) throw new Error(res.error);
    return res.clientSecret;
  }, [order]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  async function payWithMercadoPago() {
    if (!order) return;
    setMpLoading(true);
    setMpError(null);
    try {
      const res = await createMercadoPagoCheckout({
        data: { orderId: order, returnOrigin: window.location.origin },
      });
      if ("error" in res) throw new Error(res.error);
      window.location.href = res.url;
    } catch (e) {
      setMpError((e as Error)?.message ?? "Não foi possível abrir o Mercado Pago.");
      setMpLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link to="/planos" className="mb-6 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar aos planos
        </Link>

        <h1 className="font-display text-2xl font-bold tracking-tight">Pagamento seguro</h1>
        <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-neon" /> Seus dados são processados pelo provedor de pagamento — o Shadow não guarda cartão.
        </p>

        {!order ? (
          <div className="mt-6 rounded-lg border border-border bg-card/60 p-4">
            <p className="flex items-center gap-2 font-mono text-xs text-danger">
              <AlertTriangle className="h-4 w-4" /> Pedido não encontrado. Volte e escolha o plano novamente.
            </p>
          </div>
        ) : loadingProviders ? (
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-card/60 p-4 font-mono text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando formas de pagamento…
          </div>
        ) : !stripeOn && !mpOn ? (
          <div className="mt-6 rounded-lg border border-border bg-card/60 p-4">
            <p className="flex items-center gap-2 font-mono text-xs text-danger">
              <AlertTriangle className="h-4 w-4" /> Pagamentos ainda não estão ativados nesta versão do site.
            </p>
          </div>
        ) : (
          <>
            {stripeOn && mpOn && (
              <>
                <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Escolha como quer pagar
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <ProviderCard
                    active={provider === "mercadopago"}
                    onClick={() => setProvider("mercadopago")}
                    logo={mercadoPagoLogo}
                    brand="Mercado Pago"
                    title="Pix, cartão ou boleto"
                    subtitle="No Pix o acesso é liberado na hora"
                    badge="Recomendado para Pix"
                    badgeTone="neon"
                  />
                  <ProviderCard
                    active={provider === "stripe"}
                    onClick={() => setProvider("stripe")}
                    logo={stripeLogo}
                    brand="Stripe"
                    title="Cartão de crédito"
                    subtitle="Ideal para cartão — formulário seguro aqui no site"
                    badge="Em desenvolvimento"
                    badgeTone="warn"
                  />
                </div>
              </>
            )}


            <div className="mt-4 rounded-lg border border-border bg-card/60 p-3 sm:p-4">
              {provider === "stripe" ? (
                <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              ) : provider === "mercadopago" ? (
                <div className="space-y-3">
                  <p className="font-mono text-xs text-muted-foreground">
                    Você será levado ao ambiente seguro do Mercado Pago para pagar com Pix, boleto ou cartão. Assim que o
                    pagamento for aprovado, sua licença é liberada automaticamente.
                  </p>
                  {mpError && (
                    <p className="flex items-center gap-2 font-mono text-xs text-danger">
                      <AlertTriangle className="h-4 w-4" /> {mpError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={payWithMercadoPago}
                    disabled={mpLoading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-neon px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-background transition hover:opacity-90 disabled:opacity-60 sm:w-auto"
                  >
                    {mpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    {mpLoading ? "Abrindo Mercado Pago…" : "Pagar com Mercado Pago"}
                  </button>
                </div>
              ) : (
                <p className="font-mono text-xs text-muted-foreground">
                  Selecione uma forma de pagamento acima para continuar.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function ProviderCard({
  active,
  onClick,
  logo,
  brand,
  title,
  subtitle,
  badge,
  badgeTone,
}: {
  active: boolean;
  onClick: () => void;
  logo: string;
  brand: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeTone?: "neon" | "warn";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition",
        active ? "border-neon bg-neon/5" : "border-border bg-card/40 hover:border-muted-foreground/40",
      )}
    >
      <img src={logo} alt={`Logo ${brand}`} className="mt-0.5 h-8 w-11 shrink-0 rounded object-contain" loading="lazy" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{brand}</span>
        <span className="mt-0.5 block text-xs text-foreground/80">{title}</span>
        <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{subtitle}</span>
        {badge && (
          <span
            className={cn(
              "mt-1.5 inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
              badgeTone === "warn"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                : "border-neon/40 bg-neon/10 text-neon",
            )}
          >
            {badge}
          </span>
        )}
      </span>
    </button>

  );
}
