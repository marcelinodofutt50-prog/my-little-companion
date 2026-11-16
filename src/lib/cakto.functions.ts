import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCaktoCheckoutEnabled = createServerFn({ method: "GET" }).handler(async () => {
  const { caktoConfig } = await import("./cakto.server");
  return process.env["CAKTO_CHECKOUT_ENABLED"] === "true" && Boolean(caktoConfig());
});

export const createCaktoCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ orderId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    const { caktoConfig } = await import("./cakto.server");
    const config = caktoConfig();
    if (!config || process.env["CAKTO_CHECKOUT_ENABLED"] !== "true") {
      return { error: "Checkout Cakto indisponível." };
    }

    const { CAKTO_AMOUNT, CAKTO_PLAN, CAKTO_CHECKOUT, makeCaktoCallback } =
      await import("./cakto-protocol.server");
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("id,user_id,plan_slug,amount,status,mp_payment_id,mp_preference_id,coupon_code,cashback_used,metadata,created_at")
      .eq("id", data.orderId)
      .eq("user_id", context.userId)
      .maybeSingle();
    const metadata = order?.metadata as Record<string, unknown> | null | undefined;
    if (error || !order || order.plan_slug !== CAKTO_PLAN ||
        !["pending", "created"].includes(order.status) || order.amount !== CAKTO_AMOUNT ||
        order.mp_payment_id || order.mp_preference_id || metadata?.gift) {
      return { error: "Pedido indisponível para pagamento pela Cakto." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { validateCanonicalOrderAmount } = await import("./order-integrity.server");
    const integrity = await validateCanonicalOrderAmount(supabaseAdmin, {
      ...order,
      metadata: metadata ?? null,
    });
    if (!integrity.ok || integrity.expectedAmount !== CAKTO_AMOUNT) {
      return { error: "O valor do pedido não corresponde ao plano Cakto." };
    }

    const url = new URL(CAKTO_CHECKOUT);
    url.searchParams.set("callback", makeCaktoCallback(order.id, config.callbackSecret));
    return { url: url.toString() };
  });
