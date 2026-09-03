import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Quais formas de pagamento estão ativas nesta instalação (usado no checkout). */
export const getPaymentProviders = createServerFn({ method: "GET" }).handler(async () => {
  const { isMercadoPagoConfigured, mercadoPagoEnvironment } = await import("@/lib/mercadopago.server");
  const mercadopago = isMercadoPagoConfigured();
  return {
    stripe: Boolean(process.env["STRIPE_LIVE_API_KEY"] || process.env["STRIPE_SANDBOX_API_KEY"]),
    mercadopago,
    mercadopagoEnvironment: mercadopago ? mercadoPagoEnvironment() : null,
  };
});

/** Cria a preferência do Mercado Pago para o pedido e devolve o link de pagamento. */
export const createMercadoPagoCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ orderId: z.string().uuid(), returnOrigin: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
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
      const { createOrderPreference, isMercadoPagoConfigured } = await import("@/lib/mercadopago.server");
      if (!isMercadoPagoConfigured()) {
        return { error: "O Mercado Pago ainda não está configurado nesta versão do site." };
      }

      const origin = data.returnOrigin.replace(/\/$/, "");
      const pref = await createOrderPreference({
        order: order as any,
        planName: integrity.planName ?? order.plan_slug,
        expectedAmount: integrity.expectedAmount,
        buyerEmail: (claims?.email as string | undefined) ?? undefined,
        returnOrigin: origin,
        notificationUrl: `${origin}/api/public/payments/mercadopago`,
      });

      await supabaseAdmin
        .from("orders")
        .update({ mp_preference_id: pref.preferenceId } as any)
        .eq("id", order.id);

      return { url: pref.initPoint };
    } catch (error) {
      return { error: (error as Error)?.message ?? "Não foi possível abrir o Mercado Pago." };
    }
  });
