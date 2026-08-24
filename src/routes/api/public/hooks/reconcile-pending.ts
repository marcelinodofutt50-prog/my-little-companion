import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Cron-safe reconciliation of pending orders.
 * Scans orders created in the last 24h that are still pending/created/yaarsa_failed,
 * asks Mercado Pago for the definitive payment status, and fulfills or fails them.
 *
 * Auth: Bearer CRON_SECRET (Vercel Cron) ou CRON_TRIGGER_TOKEN legado.
 */
export const Route = createFileRoute("/api/public/hooks/reconcile-pending")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        return reconcilePendingOrders(request);
      },
      GET: async ({ request }) => {
        return reconcilePendingOrders(request);
      },
    },
  },
});

async function reconcilePendingOrders(request: Request) {
        const { cronUnauthorized } = await import("@/lib/cron-auth.server");
        const denied = cronUnauthorized(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { findPaidPaymentForOrder, serverStripeEnv } = await import("@/lib/stripe-payments.server");
        const stripeEnv = serverStripeEnv();


        // 72h: se um painel ficou sem servidor configurado, a entrega continua
        // sendo tentada por 3 dias depois que o admin arruma a VPS.
        const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
        const { data: orders, error } = await supabaseAdmin
          .from("orders")
          .select("id, status, amount, mp_payment_id, mp_preference_id, created_at, processing_at, next_retry_at, fulfillment_attempts")
          .in("status", ["pending", "created", "yaarsa_failed", "processing"])
          .gt("created_at", cutoff)
          .order("created_at", { ascending: true })
          .limit(100);


        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        const results: { orderId: string; action: string; detail?: string }[] = [];

        const now = Date.now();
        const { MAX_FULFILLMENT_ATTEMPTS } = await import("@/lib/fulfillment.server");

        for (const order of (orders ?? []) as any[]) {
          try {
            // Backoff: ainda não chegou a hora da próxima tentativa.
            if (order.next_retry_at && new Date(order.next_retry_at).getTime() > now) {
              results.push({ orderId: order.id, action: "skipped", detail: "backoff" });
              continue;
            }
            // Esgotou as tentativas automáticas — precisa de intervenção manual.
            if (Number(order.fulfillment_attempts ?? 0) >= MAX_FULFILLMENT_ATTEMPTS) {
              results.push({ orderId: order.id, action: "skipped", detail: "max-attempts" });
              continue;
            }
            // "processing" só é reprocessado se estiver travado há mais de 10 min.
            if (order.status === "processing") {
              const since = order.processing_at ? new Date(order.processing_at).getTime() : 0;
              if (now - since < 10 * 60 * 1000) {
                results.push({ orderId: order.id, action: "skipped", detail: "processing" });
                continue;
              }
              await supabaseAdmin
                .from("orders")
                .update({ status: "pending", processing_at: null } as any)
                .eq("id", order.id)
                .eq("status", "processing");
            }

            // Pergunta direto ao provedor de pagamento se este pedido foi pago
            // (pela sessão de checkout e, como reforço, pelo id do pedido).
            const paid = await findPaidPaymentForOrder(
              stripeEnv,
              order.id,
              order.mp_preference_id,
              Number(order.amount),
            );
            if (paid) {
              await supabaseAdmin.from("orders").update({ mp_payment_id: String(paid.id) }).eq("id", order.id);
              const { fulfillOrder } = await import("@/lib/fulfillment.server");
              const result = await fulfillOrder(order.id);
              results.push({ orderId: order.id, action: result.ok ? "fulfilled" : "fulfill-error", detail: (result as any).reason });
              continue;
            }

            // Sessão expirada sem pagamento: encerra o pedido para não ficar preso.
            if (order.mp_preference_id) {
              try {
                const { createStripeClient } = await import("@/lib/stripe.server");
                const stripe = createStripeClient(stripeEnv);
                const session = await stripe.checkout.sessions.retrieve(String(order.mp_preference_id));
                if (session.status === "expired") {
                  await supabaseAdmin.from("orders").update({ status: "failed" } as any).eq("id", order.id);
                  results.push({ orderId: order.id, action: "marked-failed", detail: "session-expired" });
                  continue;
                }
              } catch { /* consulta best-effort */ }
            }

            }

            results.push({ orderId: order.id, action: "no-change", detail: "still-pending" });
          } catch (e: any) {
            results.push({ orderId: order.id, action: "error", detail: e?.message ?? String(e) });
          }
        }

        return new Response(JSON.stringify({ processed: results.length, results }), {
          headers: { "Content-Type": "application/json" },
        });
}
