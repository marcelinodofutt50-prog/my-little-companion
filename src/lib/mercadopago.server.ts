// Server-only Mercado Pago helpers.
const MP_API = "https://api.mercadopago.com";

function token() {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error("MP_ACCESS_TOKEN not set");
  return t;
}

export type MpPreferenceInput = {
  orderId: string;
  planName: string;
  amount: number;
  payerEmail?: string;
  successUrl: string;
  pendingUrl: string;
  failureUrl: string;
  notificationUrl: string;
};

export async function createMpPreference(input: MpPreferenceInput) {
  const body = {
    items: [{
      id: input.orderId,
      title: input.planName,
      quantity: 1,
      currency_id: "BRL",
      unit_price: Number(input.amount.toFixed(2)),
    }],
    payer: input.payerEmail ? { email: input.payerEmail } : undefined,
    external_reference: input.orderId,
    back_urls: {
      success: input.successUrl,
      pending: input.pendingUrl,
      failure: input.failureUrl,
    },
    auto_return: "approved",
    notification_url: input.notificationUrl,
    statement_descriptor: "SHADOW",
  };
  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MP preference [${res.status}]: ${text}`);
  return JSON.parse(text) as { id: string; init_point: string; sandbox_init_point: string };
}

export async function getMpPayment(paymentId: string) {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MP payment [${res.status}]: ${text}`);
  return JSON.parse(text) as {
    id: number;
    status: string;
    status_detail: string;
    transaction_amount: number;
    external_reference: string;
    payer?: { email?: string };
  };
}
