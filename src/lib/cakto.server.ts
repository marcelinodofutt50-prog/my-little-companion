import { z } from "zod";
import { CAKTO_AMOUNT, readCaktoCallback, verifyCaktoSignature } from "./cakto-protocol.server";

const MAX_BODY_BYTES = 256 * 1024;
const orderSchema = z.object({
  id: z.string().min(1).max(128),
  offer_type: z.string(),
  product: z.object({ id: z.string() }),
  offer: z.object({ id: z.string() }).nullable(),
  subscription: z.object({ id: z.union([z.string().min(1).max(128), z.number().int().positive()]) }).nullable(),
  callback: z.string().max(255).nullish(),
  status: z.string(),
  currency: z.string(),
  amount: z.number().nullable(),
  paidAt: z.iso.datetime({ offset: true }).nullish(),
});
const envelopeSchema = z.object({ event: z.string(), data: z.unknown() });
const handled = new Set(["purchase_approved", "subscription_renewed", "subscription_canceled", "refund", "chargeback"]);
const actionSchema = z.object({
  action: z.enum(["unlinked", "rejected", "done", "fulfill", "sync", "revoke"]),
  orderId: z.string().optional(),
  email: z.string().nullish(),
  panel: z.string().nullish(),
  expiresAt: z.string().nullish(),
});

export function caktoConfig(reportIssue?: (issue: string) => void) {
  const secret = process.env["CAKTO_WEBHOOK_SECRET"];
  const callbackSecret = process.env["CAKTO_CALLBACK_SECRET"];
  const productId = process.env["CAKTO_PRODUCT_ID"];
  const offerId = process.env["CAKTO_OFFER_ID"];
  if (!secret) reportIssue?.("CAKTO_WEBHOOK_SECRET missing");
  if (!callbackSecret) reportIssue?.("CAKTO_CALLBACK_SECRET missing");
  else if (callbackSecret.length < 32) reportIssue?.("CAKTO_CALLBACK_SECRET too short");
  else if (callbackSecret === secret) reportIssue?.("CAKTO_CALLBACK_SECRET must differ from CAKTO_WEBHOOK_SECRET");
  if (!productId) reportIssue?.("CAKTO_PRODUCT_ID missing");
  if (!offerId) reportIssue?.("CAKTO_OFFER_ID missing");
  if (!secret || !callbackSecret || callbackSecret.length < 32 || callbackSecret === secret ||
      !productId || !offerId) return null;
  return { secret, callbackSecret, productId, offerId };
}

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return Buffer.concat(chunks, total);
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function handleCaktoWebhook(request: Request) {
  const config = caktoConfig((issue) => console.error("[cakto] configuration:", issue));
  if (!config) return new Response(null, { status: 503 });
  const body = await readBody(request).catch(() => null);
  if (body === null) return new Response(null, { status: 413 });
  if (!verifyCaktoSignature(config.secret, body, request.headers)) {
    return new Response(null, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    return new Response(null, { status: 400 });
  }
  const envelope = envelopeSchema.safeParse(payload);
  if (!envelope.success) return new Response(null, { status: 400 });
  const { event, data } = envelope.data;
  if (!handled.has(event)) return new Response(null, { status: 204 });

  const candidates = (Array.isArray(data) ? data : [data]).map((item) => orderSchema.safeParse(item));
  if (candidates.some((item) => !item.success)) return new Response(null, { status: 400 });
  const orders = candidates.flatMap((item) => {
    if (!item.success) return [];
    const order = item.data;
    return order.offer_type === "main" && order.product.id === config.productId &&
      order.offer?.id === config.offerId ? [order] : [];
  });
  if (!orders.length) return new Response(null, { status: 204 });
  const [order] = orders;
  if (orders.length !== 1 || !order?.subscription) return new Response(null, { status: 422 });
  const paid = event === "purchase_approved" || event === "subscription_renewed";
  if (paid && (order.status !== "paid" || order.amount !== CAKTO_AMOUNT ||
      order.currency !== "BRL" || !order.paidAt)) {
    return new Response(null, { status: 422 });
  }

  const orderId = readCaktoCallback(order.callback, config.callbackSecret);
  try {
    const result = await applyEvent(event, String(order.subscription.id), order.id, orderId, order.paidAt ?? null);
    return new Response(null, { status: result });
  } catch {
    console.error("[cakto] webhook processing failed");
    return new Response(null, { status: 503 });
  }
}

async function applyEvent(
  event: string, subscriptionId: string, paymentId: string, orderId: string | null, paidAt: string | null,
) {
  const { acquireOpLock, releaseOpLock } = await import("./audit-trail.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const lockKey = "cakto:" + subscriptionId;
  if (!(await acquireOpLock(lockKey, 300))) return 503;
  try {
    // This RPC is introduced by the Cakto migration. Keep the result validated at the boundary.
    const { data, error } = await supabaseAdmin.rpc("apply_cakto_event" as never, {
      p_event: event, p_subscription: subscriptionId, p_payment: paymentId,
      p_order: orderId, p_paid_at: paidAt,
    } as never);
    if (error) {
      console.error("[cakto] apply_cakto_event failed", error.code);
      return 503;
    }
    const result = actionSchema.parse(data);
    if (result.action === "unlinked") return event === "purchase_approved" ? 422 : 503;
    if (result.action === "rejected") return 422;
    if (result.action === "fulfill") {
      if (!result.orderId) return 503;
      const { fulfillOrder } = await import("./fulfillment.server");
      const delivery = await fulfillOrder(result.orderId);
      return delivery.ok && delivery.reason !== "in-progress" ? 204 : 503;
    }
    if (result.email && (result.action === "sync" || result.action === "revoke")) {
      const { setExpiryAnyPanel, suspendAccountAnyPanel, yesterdayYmd } = await import("./license-cron.server");
      const sync = result.action === "revoke"
        ? await suspendAccountAnyPanel(result.email, result.panel, yesterdayYmd())
        : result.expiresAt && await setExpiryAnyPanel(result.email, result.panel, result.expiresAt);
      return sync && sync.status === "done" ? 204 : 503;
    }
    return 204;
  } finally {
    await releaseOpLock(lockKey);
  }
}
