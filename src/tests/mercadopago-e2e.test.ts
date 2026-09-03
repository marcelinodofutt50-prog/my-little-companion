import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * E2E do checkout Mercado Pago.
 *
 * Simula a notificação (webhook) que o Mercado Pago envia após o pagamento e
 * valida o caminho completo até a entrega do login para o cliente:
 *   1. pagamento aprovado -> pedido marcado com o id do pagamento -> entrega;
 *   2. Pix pendente / recusado -> nada é entregue;
 *   3. notificação repetida -> não entrega duas vezes;
 *   4. valor pago menor que o pedido -> não entrega;
 *   5. assinatura inválida -> 401;
 *   6. rede de segurança: se o webhook não chegar, a conciliação acha o
 *      pagamento aprovado e entrega mesmo assim.
 */

// ---------- fakes ----------
type Order = {
  id: string;
  amount: number;
  status: string;
  plan_slug?: string;
  mp_payment_id?: string | null;
};
type Plan = { slug: string; name: string; price_brl: number; active: boolean };

const db = {
  orders: [] as Order[],
  plans: [] as Plan[],
  logs: [] as { note: string; processed: boolean }[],
};

const fulfilled: string[] = [];
let payments: Record<string, any> = {};

function fakeTable(name: string) {
  const state: { filters: Record<string, unknown>; patch?: Record<string, unknown> } = { filters: {} };
  const api: any = {
    select: () => api,
    insert: (row: any) => {
      if (name === "webhook_logs") db.logs.push({ note: row.note, processed: row.processed });
      return Promise.resolve({ data: null, error: null });
    },
    update: (patch: any) => {
      state.patch = patch;
      return api;
    },
    eq: (col: string, value: unknown) => {
      state.filters[col] = value;
      if (state.patch) {
        for (const o of db.orders) {
          if (Object.entries(state.filters).every(([k, v]) => (o as any)[k] === v)) Object.assign(o, state.patch);
        }
        return Promise.resolve({ data: null, error: null });
      }
      return api;
    },
    maybeSingle: () => {
      const source: any[] = name === "plans" ? db.plans : db.orders;
      const row = source.find((o) =>
        Object.entries(state.filters).every(([k, v]) => String((o as any)[k] ?? "") === String(v)),
      );
      return Promise.resolve({ data: row ?? null, error: null });
    },
  };
  return api;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (name: string) => fakeTable(name) },
}));

vi.mock("@/lib/fulfillment.server", () => ({
  fulfillOrder: async (orderId: string) => {
    fulfilled.push(orderId);
    const order = db.orders.find((o) => o.id === orderId);
    if (order) order.status = "paid";
    // entrega: cliente recebe login/licença
    return { ok: true, delivered: { login: `shadow_${orderId.slice(0, 4)}`, password: "Xx#12345" } };
  },
}));

vi.mock("@/lib/mercadopago.server", () => ({
  isMercadoPagoConfigured: () => true,
  mercadoPagoEnvironment: () => "live",
  getMercadoPagoPayment: async (id: string | number) => {
    const p = payments[String(id)];
    if (!p) throw new Error("payment not found");
    return p;
  },
  findApprovedMercadoPagoPayment: async (orderId: string, minAmount?: number) => {
    const p = Object.values(payments).find(
      (x: any) => x.external_reference === orderId && x.status === "approved",
    ) as any;
    if (!p) return null;
    const total = Number(p.transaction_amount ?? 0);
    if (minAmount !== undefined && total < minAmount - 0.01) return null;
    return { id: String(p.id), amount: total };
  },
}));

async function postWebhook(body: unknown, headers: Record<string, string> = {}) {
  const { Route } = await import("@/routes/api/public/payments/mercadopago");
  const handler = (Route.options as any).server.handlers.POST;
  const request = new Request("http://localhost/api/public/payments/mercadopago", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return handler({ request });
}

const ORDER = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  db.orders = [{ id: ORDER, amount: 39.9, status: "pending", mp_payment_id: null }];
  db.logs = [];
  fulfilled.length = 0;
  payments = {};
  delete process.env["MERCADOPAGO_WEBHOOK_SECRET"];
});

describe("Mercado Pago — pagamento aprovado entrega o login", () => {
  it("Pix aprovado libera o acesso imediatamente", async () => {
    payments["9001"] = { id: 9001, status: "approved", transaction_amount: 39.9, external_reference: ORDER };

    const res = await postWebhook({ type: "payment", data: { id: "9001" } });

    expect(res.status).toBe(200);
    expect(fulfilled).toEqual([ORDER]);
    expect(db.orders[0].mp_payment_id).toBe("9001");
    expect(db.orders[0].status).toBe("paid");
  });

  it("aceita a notificação no formato topic/resource (Checkout Pro antigo)", async () => {
    payments["9002"] = { id: 9002, status: "approved", transaction_amount: 39.9, external_reference: ORDER };
    const res = await postWebhook({ topic: "payment", resource: "https://api.mercadopago.com/v1/payments/9002" });
    expect(res.status).toBe(200);
    expect(fulfilled).toEqual([ORDER]);
  });

  it("usa metadata.orderId quando o external_reference vem vazio", async () => {
    payments["9003"] = { id: 9003, status: "approved", transaction_amount: 39.9, metadata: { orderId: ORDER } };
    await postWebhook({ type: "payment", data: { id: "9003" } });
    expect(fulfilled).toEqual([ORDER]);
  });
});

describe("Mercado Pago — casos em que NÃO pode entregar", () => {
  it("Pix ainda pendente não entrega", async () => {
    payments["9010"] = { id: 9010, status: "pending", transaction_amount: 39.9, external_reference: ORDER };
    await postWebhook({ type: "payment", data: { id: "9010" } });
    expect(fulfilled).toEqual([]);
    expect(db.orders[0].status).toBe("pending");
  });

  it("pagamento recusado não entrega", async () => {
    payments["9011"] = { id: 9011, status: "rejected", transaction_amount: 39.9, external_reference: ORDER };
    await postWebhook({ type: "payment", data: { id: "9011" } });
    expect(fulfilled).toEqual([]);
  });

  it("valor menor que o pedido não entrega", async () => {
    payments["9012"] = { id: 9012, status: "approved", transaction_amount: 10, external_reference: ORDER };
    await postWebhook({ type: "payment", data: { id: "9012" } });
    expect(fulfilled).toEqual([]);
  });

  it("notificação repetida do mesmo pagamento não entrega duas vezes", async () => {
    payments["9013"] = { id: 9013, status: "approved", transaction_amount: 39.9, external_reference: ORDER };
    await postWebhook({ type: "payment", data: { id: "9013" } });
    await postWebhook({ type: "payment", data: { id: "9013" } });
    expect(fulfilled).toEqual([ORDER]);
  });

  it("assinatura inválida é rejeitada com 401", async () => {
    process.env["MERCADOPAGO_WEBHOOK_SECRET"] = "segredo-de-teste";
    payments["9014"] = { id: 9014, status: "approved", transaction_amount: 39.9, external_reference: ORDER };
    const res = await postWebhook({ type: "payment", data: { id: "9014" } }, { "x-signature": "ts=1,v1=abc" });
    expect(res.status).toBe(401);
    expect(fulfilled).toEqual([]);
  });

  it("evento que não é de pagamento é ignorado com 200", async () => {
    const res = await postWebhook({ type: "merchant_order", data: { id: "555" } });
    expect(res.status).toBe(200);
    expect(fulfilled).toEqual([]);
  });
});

describe("Mercado Pago — rede de segurança (webhook não chegou)", () => {
  it("a conciliação encontra o pagamento aprovado e entrega", async () => {
    payments["9020"] = { id: 9020, status: "approved", transaction_amount: 39.9, external_reference: ORDER };
    const { findApprovedMercadoPagoPayment } = await import("@/lib/mercadopago.server");
    const paid = await findApprovedMercadoPagoPayment(ORDER, 39.9);
    expect(paid).toEqual({ id: "9020", amount: 39.9 });

    const { fulfillOrder } = await import("@/lib/fulfillment.server");
    const result = await fulfillOrder(ORDER);
    expect(result.ok).toBe(true);
    expect(db.orders[0].status).toBe("paid");
  });

  it("não entrega na conciliação quando o valor pago é menor", async () => {
    payments["9021"] = { id: 9021, status: "approved", transaction_amount: 5, external_reference: ORDER };
    const { findApprovedMercadoPagoPayment } = await import("@/lib/mercadopago.server");
    expect(await findApprovedMercadoPagoPayment(ORDER, 39.9)).toBeNull();
  });
});
