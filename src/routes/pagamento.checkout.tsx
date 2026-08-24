import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";
import { getStripe, getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";
import { createOrderPaymentSession } from "@/lib/payments.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/pagamento/checkout")({
  validateSearch: (search: Record<string, unknown>): { order?: string } => ({
    order: typeof search.order === "string" ? search.order : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Pagamento seguro — Shadow" },
      { name: "description", content: "Finalize sua compra Shadow com pagamento seguro por cartão ou Pix, direto no site." },
      { property: "og:title", content: "Pagamento seguro — Shadow" },
      { property: "og:description", content: "Finalize sua compra Shadow com pagamento seguro, sem sair do site." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { order } = Route.useSearch();

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

        <div className="mt-6 rounded-lg border border-border bg-card/60 p-3 sm:p-4">
          {!order ? (
            <p className="flex items-center gap-2 font-mono text-xs text-danger">
              <AlertTriangle className="h-4 w-4" /> Pedido não encontrado. Volte e escolha o plano novamente.
            </p>
          ) : !isPaymentsConfigured() ? (
            <p className="flex items-center gap-2 font-mono text-xs text-danger">
              <AlertTriangle className="h-4 w-4" /> Pagamentos ainda não estão ativados nesta versão do site.
            </p>
          ) : (
            <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </div>
      </div>
    </main>
  );
}
