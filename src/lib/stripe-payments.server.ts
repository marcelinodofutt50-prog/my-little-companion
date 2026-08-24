/**
 * Server-only Stripe helpers para o fluxo de compra do Shadow.
 *
 * Regras de negócio (validação de plano, cupom, cashback, presentes, legacy)
 * continuam em checkout.functions.ts. Aqui só cuidamos do pagamento em si:
 * criar a sessão de checkout, reconciliar pagamentos e reembolsar.
 */
import { createStripeClient, type StripeEnv } from "./stripe.server";

/** Planos que o cliente paga de forma recorrente (assinatura). */
export const RECURRING_PRICE_BY_SLUG: Record<string, string> = {
  monthly_457: "monthly_457",
  "login-30d": "monthly_457",
  trial: "trial",
  "login-7d": "trial",
  "kraken-monthly": "kraken_monthly",
  "play-protect-monthly": "play_protect_monthly",
};

/** Quantos dias cada assinatura renova por ciclo. */
export const RECURRING_DAYS_BY_SLUG: Record<string, number> = {
  monthly_457: 30,
  "login-30d": 30,
  trial: 7,
  "login-7d": 7,
  "kraken-monthly": 30,
  "play-protect-monthly": 30,
};

export function stripeEnvFromToken(token?: string | null): StripeEnv {
  if (token?.startsWith("pk_live_")) return "live";
  return "sandbox";
}

/**
 * Encontra (ou cria) o Customer do Stripe carregando `metadata.userId`, para
 * que consultas futuras (assinaturas, faturas, reembolsos) sempre achem o
 * cliente certo.
 */
export async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string | undefined> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  if (!options.email && !options.userId) return undefined;
  const created = await stripe.customers.create({
    ...(options.email ? { email: options.email } : {}),
    ...(options.userId ? { metadata: { userId: options.userId } } : {}),
  });
  return created.id;
}

export type OrderForCheckout = {
  id: string;
  user_id: string;
  plan_slug: string;
  amount: number | string;
  coupon_code?: string | null;
  cashback_used?: number | string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Assinatura só entra quando o valor cobrado é exatamente o preço de tabela.
 * Com cupom, cashback, addons, presente ou fluxo legacy o pedido virou um
 * valor único — nesses casos cobramos uma vez (price_data) para não criar
 * uma assinatura com valor errado.
 */
export function subscriptionPriceForOrder(
  order: OrderForCheckout,
  planPriceBrl: number,
): string | null {
  const lookup = RECURRING_PRICE_BY_SLUG[order.plan_slug];
  if (!lookup) return null;
  const meta = (order.metadata ?? {}) as Record<string, unknown>;
  if (meta["gift"] || meta["legacy_claim"] || meta["upgrade"]) return null;
  if (order.coupon_code) return null;
  if (Number(order.cashback_used ?? 0) > 0) return null;
  if (Math.abs(Number(order.amount) - Number(planPriceBrl)) > 0.009) return null;
  return lookup;
}

export type CheckoutSessionInfo = {
  sessionId: string;
  clientSecret: string;
};

export async function createOrderCheckoutSession(params: {
  env: StripeEnv;
  order: OrderForCheckout;
  planName: string;
  planPriceBrl: number;
  buyerEmail?: string;
  returnUrl: string;
}): Promise<CheckoutSessionInfo> {
  const { env, order } = params;
  const stripe = createStripeClient(env);

  const customerId = await resolveOrCreateCustomer(stripe, {
    email: params.buyerEmail,
    userId: order.user_id,
  });

  const lookupKey = subscriptionPriceForOrder(order, params.planPriceBrl);
  const amountCents = Math.round(Number(order.amount) * 100);
  const metadata = {
    orderId: order.id,
    userId: order.user_id,
    planSlug: order.plan_slug,
  };

  let lineItem: any;
  let isRecurring = false;
  if (lookupKey) {
    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
    if (prices.data.length) {
      lineItem = { price: prices.data[0].id, quantity: 1 };
      isRecurring = prices.data[0].type === "recurring";
    }
  }
  if (!lineItem) {
    lineItem = {
      price_data: {
        currency: "brl",
        product_data: { name: `Shadow — ${params.planName}` },
        unit_amount: amountCents,
      },
      quantity: 1,
    };
  }

  const session = await stripe.checkout.sessions.create({
    line_items: [lineItem],
    mode: isRecurring ? "subscription" : "payment",
    ui_mode: "embedded_page",
    return_url: params.returnUrl,
    ...(customerId ? { customer: customerId } : {}),
    metadata,
    ...(isRecurring
      ? { subscription_data: { metadata } }
      : {
          payment_intent_data: {
            description: `Shadow — ${params.planName}`,
            metadata,
          },
        }),
  });

  return { sessionId: session.id, clientSecret: session.client_secret ?? "" };
}

/**
 * Rede de segurança: pergunta direto ao Stripe se o pedido já foi pago.
 * Usada quando o webhook não chegou (ou falhou) para nunca deixar um cliente
 * pagante sem acesso.
 */
export async function findPaidPaymentForOrder(
  env: StripeEnv,
  orderId: string,
  sessionId?: string | null,
  minAmount?: number,
): Promise<{ id: string; amount: number } | null> {
  const stripe = createStripeClient(env);

  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
      const total = Number(session.amount_total ?? 0) / 100;
      if (paid && (minAmount === undefined || total >= minAmount - 0.01)) {
        const paymentId =
          (typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id) ??
          (typeof session.subscription === "string" ? session.subscription : session.subscription?.id) ??
          session.id;
        return { id: paymentId, amount: total };
      }
    } catch {
      /* segue para a busca por metadata */
    }
  }

  if (!/^[a-zA-Z0-9-]+$/.test(orderId)) return null;
  try {
    const found = await stripe.paymentIntents.search({
      query: `metadata['orderId']:'${orderId}' AND status:'succeeded'`,
      limit: 1,
    });
    const pi = found.data[0];
    if (!pi) return null;
    const total = Number(pi.amount_received ?? pi.amount ?? 0) / 100;
    if (minAmount !== undefined && total < minAmount - 0.01) return null;
    return { id: pi.id, amount: total };
  } catch {
    return null;
  }
}

/** Reembolso — aceita PaymentIntent, Charge ou id de sessão de checkout. */
export async function refundStripePayment(
  env: StripeEnv,
  paymentRef: string,
  amountBrl?: number,
): Promise<{ id: string; status: string | null }> {
  const stripe = createStripeClient(env);
  let paymentIntentId = paymentRef;

  if (paymentRef.startsWith("cs_")) {
    const session = await stripe.checkout.sessions.retrieve(paymentRef);
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!pi) throw new Error("Sessão de checkout sem pagamento associado");
    paymentIntentId = pi;
  }

  const refund = await stripe.refunds.create({
    ...(paymentIntentId.startsWith("ch_")
      ? { charge: paymentIntentId }
      : { payment_intent: paymentIntentId }),
    ...(amountBrl !== undefined ? { amount: Math.round(amountBrl * 100) } : {}),
  });
  return { id: refund.id, status: refund.status ?? null };
}

/**
 * Ambiente usado pelas rotinas de servidor (conciliação, reembolso, cron).
 * Se o projeto já tem as chaves de produção, usamos produção.
 */
export function serverStripeEnv(): StripeEnv {
  return process.env['STRIPE_LIVE_API_KEY'] ? 'live' : 'sandbox';
}
