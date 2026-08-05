import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Cron-safe reconciliation of pending orders.
 * Scans orders created in the last 24h that are still pending/created/yaarsa_failed,
 * asks Mercado Pago for the definitive payment status, and fulfills or fails them.
 *
 * Auth: Bearer CRON_TRIGGER_TOKEN. No token = 401.
 */
export const Route = createFileRoute("/api/public/hooks/reconcile-pending")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronUnauthorized } = await import("@/lib/cron-auth.server");
        const denied = cronUnauthorized(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { findApprovedPaymentForOrder, getMpPayment } = await import("@/lib/mercadopago.server");

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

        for (const order of (orders ?? []) as any[]) {
          try {
            // 1) Try authoritative search by external_reference (order id).
            const approved = await findApprovedPaymentForOrder(order.id, Number(order.amount));
            if (approved) {
              await supabaseAdmin.from("orders").update({ mp_payment_id: String(approved.id) }).eq("id", order.id);
              const { fulfillOrder } = await import("@/routes/api/public/mp-webhook");
              const result = await fulfillOrder(order.id);
              results.push({ orderId: order.id, action: result.ok ? "fulfilled" : "fulfill-error", detail: (result as any).reason });
              continue;
            }

            // 2) If we already have a payment id, check its current status directly.
            if (order.mp_payment_id) {
              const payment = await getMpPayment(String(order.mp_payment_id));
              if (payment.status === "approved") {
                const { fulfillOrder } = await import("@/routes/api/public/mp-webhook");
                const result = await fulfillOrder(order.id);
                results.push({ orderId: order.id, action: result.ok ? "fulfilled" : "fulfill-error", detail: (result as any).reason });
                continue;
              }
              if (["rejected", "cancelled", "refunded"].includes(payment.status)) {
                await supabaseAdmin
                  .from("orders")
                  .update({ status: payment.status === "refunded" ? "refunded" : "failed" } as any)
                  .eq("id", order.id);
                results.push({ orderId: order.id, action: "marked-failed", detail: payment.status });
                continue;
              }
            }

            // 3) Preference-only: search for any payment tied to this preference id.
            if (order.mp_preference_id && !order.mp_payment_id) {
              const res = await fetch(
                `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&preference_id=${encodeURIComponent(order.mp_preference_id)}`,
                { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } },
              );
              if (res.ok) {
                const json = (await res.json()) as { results?: Array<{ id: number; status: string; external_reference: string }> };
                const match = (json.results ?? []).find((p) => p.external_reference === order.id);
                if (match) {
                  await supabaseAdmin.from("orders").update({ mp_payment_id: String(match.id) }).eq("id", order.id);
                  if (match.status === "approved") {
                    const { fulfillOrder } = await import("@/routes/api/public/mp-webhook");
                    const result = await fulfillOrder(order.id);
                    results.push({ orderId: order.id, action: result.ok ? "fulfilled" : "fulfill-error", detail: (result as any).reason });
                    continue;
                  }
                  if (["rejected", "cancelled", "refunded"].includes(match.status)) {
                    await supabaseAdmin
                      .from("orders")
                      .update({ status: match.status === "refunded" ? "refunded" : "failed" } as any)
                      .eq("id", order.id);
                    results.push({ orderId: order.id, action: "marked-failed", detail: match.status });
                    continue;
                  }
                }
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
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
