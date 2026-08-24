import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Simulador de webhook — SOMENTE PARA TESTES INTERNOS.
 *
 * Antes esta função era pública e sem autenticação: qualquer pessoa podia
 * marcar um pedido como pago e receber uma licença de graça. Agora exige
 * sessão autenticada + papel de admin.
 */
export const testMercadoPagoWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      orderId: z.string().uuid(),
      status: z.enum(["approved", "pending", "rejected", "refunded"]),
      amount: z.number().optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { assertAdminRole } = await import("./roles.server");
    await assertAdminRole({ supabase: context.supabase, userId: context.userId });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fulfillOrder } = await import("@/lib/fulfillment.server");

    const paymentId = `TEST-PAYMENT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // 1. Registra o ID de pagamento simulado. O status precisa continuar
    // "pending" para que fulfillOrder consiga fazer o claim atômico —
    // marcá-lo como "paid" aqui faria a entrega ser recusada (not-claimable).
    await supabaseAdmin
      .from("orders")
      .update({
        mp_payment_id: paymentId,
        status: "pending",
      } as any)
      .eq("id", data.orderId);


    // 2. Se aprovado, dispara o fluxo de entrega
    if (data.status === "approved") {
      const result = await fulfillOrder(data.orderId);

      await supabaseAdmin.from("webhook_logs").insert({
        source: "e2e_test",
        note: `Simulated fulfillment for order ${data.orderId} by admin ${context.userId}: ${result.ok ? "SUCCESS" : "FAIL"}`,
        processed: result.ok,
      });

      return { success: result.ok, paymentId, fulfillment: result };
    }

    return { success: true, paymentId, status: data.status };
  });
