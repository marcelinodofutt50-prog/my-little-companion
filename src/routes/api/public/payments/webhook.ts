import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

async function log(note: string, processed: boolean, payload?: unknown) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("webhook_logs").insert({
    source: "stripe",
    note: note.slice(0, 500),
    processed,
    ...(payload ? { payload: payload as any } : {}),
  } as any);
}

/** Primeira compra (checkout concluído): entrega o pedido do Shadow. */
async function fulfillFromSession(session: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const orderId = session.metadata?.orderId as string | undefined;
  if (!orderId) {
    await log(`sessão ${session.id} sem orderId no metadata`, false);
    return;
  }

  const paymentRef =
    (typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id) ??
    (typeof session.subscription === "string" ? session.subscription : session.subscription?.id) ??
    session.id;

  // Idempotência: pagamento já registrado num pedido pago não entrega de novo.
  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("id, status")
    .eq("mp_payment_id", String(paymentRef))
    .eq("status", "paid")
    .maybeSingle();
  if (existing) {
    await log(`pagamento duplicado ${paymentRef} ignorado`, true);
    return;
  }

  await supabaseAdmin
    .from("orders")
    .update({ mp_payment_id: String(paymentRef) } as any)
    .eq("id", orderId);

  const { fulfillOrder } = await import("@/lib/fulfillment.server");
  const result = await fulfillOrder(orderId);
  await log(
    `pedido ${orderId} → ${result.ok ? "ok" : "falha"}${(result as any).reason ? ` (${(result as any).reason})` : ""}`,
    result.ok,
  );
}

/** Renovações das assinaturas (2º ciclo em diante). */
async function handleInvoicePaid(invoice: any, env: StripeEnv) {
  if (invoice.billing_reason !== "subscription_cycle") return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const subscriptionId =
    (typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id) ?? null;
  const line = invoice.lines?.data?.[0];
  const lookupKey = line?.price?.lookup_key ?? line?.pricing?.price_details?.price ?? null;

  const { data: sub } = await supabaseAdmin
    .from("stripe_subscriptions")
    .select("user_id, plan_slug")
    .eq("stripe_subscription_id", subscriptionId)
    .eq("environment", env)
    .maybeSingle();

  const userId = (sub as any)?.user_id ?? invoice.subscription_details?.metadata?.userId ?? null;
  const planSlug = (sub as any)?.plan_slug ?? invoice.subscription_details?.metadata?.planSlug ?? lookupKey;
  if (!userId || !planSlug) {
    await log(`fatura ${invoice.id} sem vínculo de usuário/plano`, false);
    return;
  }

  const { RECURRING_DAYS_BY_SLUG } = await import("@/lib/stripe-payments.server");
  const days = RECURRING_DAYS_BY_SLUG[planSlug] ?? 30;
  const { applySubscriptionRenewal } = await import("@/lib/subscription-renewal.server");
  const result = await applySubscriptionRenewal({
    userId,
    planSlug,
    days,
    reference: String(invoice.id),
  });
  await log(`renovação ${invoice.id} (${planSlug}, ${days}d) → ${result.ok ? "ok" : result.reason}`, result.ok);
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const userId = subscription.metadata?.userId ?? null;
  if (!userId) return;

  await supabaseAdmin.from("stripe_subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
      price_id: priceId ?? null,
      plan_slug: subscription.metadata?.planSlug ?? priceId ?? null,
      status: subscription.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      environment: env,
      updated_at: new Date().toISOString(),
    } as any,
    { onConflict: "stripe_subscription_id" },
  );
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.payment_status !== "unpaid") await fulfillFromSession(session);
      else await log(`sessão ${session.id} aguardando confirmação do pagamento`, true);
      break;
    }
    case "checkout.session.async_payment_succeeded":
      await fulfillFromSession(event.data.object);
      break;
    case "checkout.session.async_payment_failed":
      await log(`pagamento não concluído na sessão ${event.data.object?.id}`, true);
      break;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object, env);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted": {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("stripe_subscriptions")
        .update({ status: "canceled", updated_at: new Date().toISOString() } as any)
        .eq("stripe_subscription_id", event.data.object.id)
        .eq("environment", env);
      break;
    }
    default:
      await log(`evento não tratado: ${event.type}`, true);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e: any) {
          console.error("[StripeWebhook]", e);
          await log(`erro: ${e?.message ?? String(e)}`, false);
          return new Response("Webhook error", { status: 400 });
        }
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
