import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const testMercadoPagoWebhook = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      orderId: z.string().uuid(),
      status: z.enum(["approved", "pending", "rejected", "refunded"]),
      amount: z.number().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    // ESTA FUNÇÃO É APENAS PARA TESTES INTERNOS E2E.
    // Ela simula o comportamento que o webhook teria ao receber uma notificação do MP.
    // Usamos o supabaseAdmin para ignorar o RLS e simular a autoridade do webhook.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fulfillOrder } = await import("@/routes/api/public/mp-webhook");

    const paymentId = `TEST-PAYMENT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    
    // 1. Atualiza o pedido com o ID de pagamento simulado
    await supabaseAdmin
      .from("orders")
      .update({ 
        mp_payment_id: paymentId,
        status: data.status === "approved" ? "paid" : "pending"
      } as any)
      .eq("id", data.orderId);

    // 2. Se aprovado, dispara o fluxo de entrega
    if (data.status === "approved") {
      const result = await fulfillOrder(data.orderId);
      
      await supabaseAdmin.from("webhook_logs").insert({
        source: "e2e_test",
        note: `Simulated fulfillment for order ${data.orderId}: ${result.ok ? "SUCCESS" : "FAIL"}`,
        processed: result.ok,
      });

      return { success: result.ok, paymentId, fulfillment: result };
    }

    return { success: true, paymentId, status: data.status };
  });
