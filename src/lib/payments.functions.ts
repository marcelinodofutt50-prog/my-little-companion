import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

const envSchema = z.enum(["sandbox", "live"]);

/**
 * Cria (ou reaproveita) a sessão de pagamento do pedido e devolve o
 * clientSecret usado pelo formulário embutido do checkout.
 */
export const createOrderPaymentSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      orderId: z.string().uuid(),
      environment: envSchema,
      returnUrl: z.string().url(),
    }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    const { supabase, userId, claims } = context;

    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id, plan_slug, amount, status, coupon_code, cashback_used, metadata")
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!order) return { error: "Pedido não encontrado." };
    if (order.status === "paid") return { error: "Este pedido já foi pago." };

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { assertCanonicalOrderAmount } = await import("@/lib/order-integrity.server");
      const integrity = await assertCanonicalOrderAmount(supabaseAdmin, order as any);
      const { createOrderCheckoutSession } = await import("@/lib/stripe-payments.server");
      const session = await createOrderCheckoutSession({
        env: data.environment as StripeEnv,
        order: order as any,
        planName: integrity.planName ?? order.plan_slug,
        planPriceBrl: integrity.expectedAmount,
        buyerEmail: (claims?.email as string | undefined) ?? undefined,
        returnUrl: data.returnUrl,
      });

      await supabaseAdmin
        .from("orders")
        .update({ mp_preference_id: session.sessionId } as any)
        .eq("id", order.id);

      if (!session.clientSecret) return { error: "O provedor de pagamento não devolveu a sessão." };
      return { clientSecret: session.clientSecret };
    } catch (error) {
      const raw = getStripeErrorMessage(error);
      if (/No valid payment method types/i.test(raw)) {
        return {
          error:
            "A conta de pagamentos ainda está em verificação pelo provedor — o checkout em produção libera assim que a análise terminar.",
        };
      }
      return { error: raw };
    }
  });

/** Assinaturas ativas do cliente (mensal / semanal). */
export const listMySubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ environment: envSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("stripe_subscriptions")
      .select("plan_slug, status, current_period_end, cancel_at_period_end")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false });
    return { subscriptions: rows ?? [] };
  });

/** Portal do cliente: cancelar assinatura, trocar cartão, ver recibos. */
export const createBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ environment: envSchema, returnUrl: z.string().url().optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    const { data: sub } = await context.supabase
      .from("stripe_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub?.stripe_customer_id) return { error: "Nenhuma assinatura encontrada nesta conta." };

    try {
      const { createStripeClient } = await import("@/lib/stripe.server");
      const stripe = createStripeClient(data.environment as StripeEnv);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        ...(data.returnUrl ? { return_url: data.returnUrl } : {}),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
