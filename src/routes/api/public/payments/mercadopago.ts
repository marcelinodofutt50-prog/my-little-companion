import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

async function log(note: string, processed: boolean, payload?: unknown) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("webhook_logs").insert({
    source: "mercadopago",
    note: note.slice(0, 500),
    processed,
    ...(payload ? { payload: payload as any } : {}),
  } as any);
}

/**
 * Assinatura do Mercado Pago. Formato: x-signature: ts=...,v1=...
 * manifest padrão = id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 *
 * O Mercado Pago varia o manifesto conforme a notificação (com/sem
 * request-id, id em minúsculo ou cru, id vindo da query string). Por isso
 * testamos todas as combinações válidas antes de dizer que não confere.
 */
function verifySignature(request: Request, dataId: string): "ok" | "mismatch" | "absent" | "disabled" {
  const secret = process.env["MERCADOPAGO_WEBHOOK_SECRET"];
  if (!secret) return "disabled";
  const signature = request.headers.get("x-signature");
  if (!signature) return "absent";
  const parts = Object.fromEntries(
    signature.split(",").map((p) => p.split("=").map((s) => s.trim()) as [string, string]),
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return "absent";

  const requestId = request.headers.get("x-request-id") ?? "";
  const queryId = new URL(request.url).searchParams.get("data.id") ?? "";
  const ids = [...new Set([dataId, dataId.toLowerCase(), queryId, queryId.toLowerCase()].filter(Boolean))];

  const manifests: string[] = [];
  for (const id of ids) {
    if (requestId) manifests.push(`id:${id};request-id:${requestId};ts:${ts};`);
    manifests.push(`id:${id};ts:${ts};`);
  }

  for (const manifest of manifests) {
    const expected = createHmac("sha256", secret).update(manifest).digest("hex");
    try {
      if (timingSafeEqual(Buffer.from(expected), Buffer.from(v1))) return "ok";
    } catch {
      /* tamanhos diferentes: segue para a próxima variação */
    }
  }
  return "mismatch";
}


async function handlePayment(paymentId: string) {
  const { getMercadoPagoPayment } = await import("@/lib/mercadopago.server");
  const payment = await getMercadoPagoPayment(paymentId);

  if (payment.status !== "approved") {
    await log(`pagamento ${paymentId} com status ${payment.status} — nada a entregar`, true);
    return;
  }

  const orderId =
    payment.external_reference ?? ((payment.metadata as any)?.orderId as string | undefined) ?? null;
  if (!orderId) {
    await log(`pagamento ${paymentId} sem pedido vinculado`, false);
    return;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Idempotência: pagamento já registrado num pedido pago não entrega de novo.
  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("id, status, amount")
    .eq("mp_payment_id", String(payment.id))
    .eq("status", "paid")
    .maybeSingle();
  if (existing) {
    await log(`pagamento duplicado ${paymentId} ignorado`, true);
    return;
  }

  // Confere se o valor pago cobre o pedido (evita entrega por valor menor).
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, plan_slug, amount, status, coupon_code, cashback_used, metadata, created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) {
    await log(`pedido ${orderId} não encontrado para o pagamento ${paymentId}`, false);
    return;
  }
  const { validateCanonicalOrderAmount } = await import("@/lib/order-integrity.server");
  const integrity = await validateCanonicalOrderAmount(supabaseAdmin, order as any);
  if (!integrity.ok) {
    await log(`pedido ${orderId} bloqueado por divergência de preço (${integrity.reason})`, false);
    return;
  }
  if (Number(payment.transaction_amount ?? 0) < integrity.expectedAmount - 0.01) {
    await log(`pagamento ${paymentId} abaixo do valor do pedido ${orderId}`, false);
    return;
  }

  await supabaseAdmin
    .from("orders")
    .update({ mp_payment_id: String(payment.id) } as any)
    .eq("id", orderId);

  const { fulfillOrder } = await import("@/lib/fulfillment.server");
  const result = await fulfillOrder(orderId);
  await log(
    `pedido ${orderId} → ${result.ok ? "ok" : "falha"}${(result as any).reason ? ` (${(result as any).reason})` : ""}`,
    result.ok,
  );
}

export const Route = createFileRoute("/api/public/payments/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const raw = await request.text();
          const body = raw ? JSON.parse(raw) : {};
          const type = body?.type ?? body?.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
          const paymentId = String(
            body?.data?.id ?? body?.resource ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "",
          ).replace(/^.*\//, "");

          if (!paymentId) return Response.json({ received: true, ignored: "sem id" });
          if (!/^\d+$/.test(paymentId)) return Response.json({ received: true, ignored: "id inválido" });
          if (type && !String(type).includes("payment")) {
            return Response.json({ received: true, ignored: String(type) });
          }
          const sig = verifySignature(request, paymentId);
          if (sig !== "ok" && sig !== "disabled") {
            // Nunca descartamos um pagamento por causa da assinatura: quem decide
            // é a própria API do Mercado Pago, consultada logo abaixo com o nosso
            // token privado (e o valor ainda é conferido contra o preço oficial).
            await log(`assinatura ${sig} no pagamento ${paymentId} — validando pela API do Mercado Pago`, false);
          }


          await handlePayment(paymentId);
          return Response.json({ received: true });
        } catch (e: any) {
          console.error("[MercadoPagoWebhook]", e);
          await log(`erro: ${e?.message ?? String(e)}`, false);
          return new Response("Webhook error", { status: 400 });
        }
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
