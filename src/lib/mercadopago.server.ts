/**
 * Server-only Mercado Pago helpers (Checkout Pro).
 *
 * Convive com a Stripe: o pedido continua sendo criado em checkout.functions.ts
 * e a entrega continua no fulfillment.server.ts. Aqui só cuidamos de criar a
 * preferência de pagamento, ler pagamentos e reconciliar.
 */

const MP_API = "https://api.mercadopago.com";

/** Aceita os dois nomes usados no projeto/deploy. */
function readAccessToken(): string | undefined {
  const token = process.env["MERCADOPAGO_ACCESS_TOKEN"] || process.env["MP_ACCESS_TOKEN"];
  return token && token.trim() !== "" ? token.trim() : undefined;
}

export function mercadoPagoAccessToken(): string {
  const token = readAccessToken();
  if (!token) throw new Error("O Mercado Pago ainda não foi configurado neste projeto.");
  return token;
}

export function isMercadoPagoConfigured(): boolean {
  return Boolean(readAccessToken());
}

/** Conta de teste (TEST-...) ou conta de produção. */
export function mercadoPagoEnvironment(): "sandbox" | "live" {
  return readAccessToken()?.startsWith("TEST-") ? "sandbox" : "live";
}

async function mpFetch<T>(path: string, init?: RequestInit & { idempotencyKey?: string }): Promise<T> {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    signal: AbortSignal.timeout(20_000),
    headers: {
      Authorization: `Bearer ${mercadoPagoAccessToken()}`,
      "Content-Type": "application/json",
      ...(init?.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = body?.message || body?.error || `Mercado Pago respondeu ${res.status}`;
    throw new Error(String(message));
  }
  return body as T;
}

export type MpPreference = { preferenceId: string; initPoint: string };

export async function createOrderPreference(params: {
  order: { id: string; user_id: string; plan_slug: string; amount: number | string };
  planName: string;
  buyerEmail?: string;
  returnOrigin: string;
  notificationUrl?: string;
}): Promise<MpPreference> {
  const origin = params.returnOrigin.replace(/\/$/, "");
  const amount = Number(Number(params.order.amount).toFixed(2));

  const pref = await mpFetch<{ id: string; init_point: string; sandbox_init_point?: string }>(
    "/checkout/preferences",
    {
      method: "POST",
      idempotencyKey: `order-${params.order.id}`,
      body: JSON.stringify({
        items: [
          {
            id: params.order.plan_slug,
            title: `Shadow — ${params.planName}`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: amount,
          },
        ],
        ...(params.buyerEmail ? { payer: { email: params.buyerEmail } } : {}),
        external_reference: params.order.id,
        metadata: {
          orderId: params.order.id,
          userId: params.order.user_id,
          planSlug: params.order.plan_slug,
        },
        statement_descriptor: "SHADOW",
        back_urls: {
          success: `${origin}/pagamento/sucesso?order=${params.order.id}`,
          pending: `${origin}/pagamento/pendente?order=${params.order.id}`,
          failure: `${origin}/pagamento/erro?order=${params.order.id}`,
        },
        auto_return: "approved",
        ...(params.notificationUrl ? { notification_url: params.notificationUrl } : {}),
      }),
    },
  );

  const initPoint =
    mercadoPagoEnvironment() === "sandbox" ? (pref.sandbox_init_point ?? pref.init_point) : pref.init_point;
  return { preferenceId: pref.id, initPoint };
}

export type MpPayment = {
  id: number | string;
  status: string;
  status_detail?: string;
  transaction_amount?: number;
  external_reference?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function getMercadoPagoPayment(paymentId: string | number): Promise<MpPayment> {
  return mpFetch<MpPayment>(`/v1/payments/${paymentId}`);
}

/**
 * Rede de segurança: pergunta direto ao Mercado Pago se o pedido já foi pago
 * (usado quando o webhook não chegou).
 */
export async function findApprovedMercadoPagoPayment(
  orderId: string,
  minAmount?: number,
): Promise<{ id: string; amount: number } | null> {
  if (!isMercadoPagoConfigured()) return null;
  if (!/^[a-zA-Z0-9-]+$/.test(orderId)) return null;
  try {
    const found = await mpFetch<{ results?: MpPayment[] }>(
      `/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc&limit=10`,
    );
    for (const payment of found.results ?? []) {
      if (payment.status !== "approved") continue;
      const total = Number(payment.transaction_amount ?? 0);
      if (minAmount !== undefined && total < minAmount - 0.01) continue;
      return { id: String(payment.id), amount: total };
    }
    return null;
  } catch {
    return null;
  }
}

/** Reembolso total ou parcial de um pagamento do Mercado Pago. */
export async function refundMercadoPagoPayment(
  paymentId: string,
  amountBrl?: number,
): Promise<{ id: string; status: string | null }> {
  const refund = await mpFetch<{ id: string | number; status?: string }>(`/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    idempotencyKey: `refund-${paymentId}-${amountBrl ?? "full"}`,
    body: JSON.stringify(amountBrl !== undefined ? { amount: Number(amountBrl.toFixed(2)) } : {}),
  });
  return { id: String(refund.id), status: refund.status ?? null };
}
