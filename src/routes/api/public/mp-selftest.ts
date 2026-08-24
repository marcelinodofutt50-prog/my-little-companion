import { createFileRoute } from "@tanstack/react-router";

// Rota temporária de diagnóstico do Mercado Pago (removida após o teste).
export const Route = createFileRoute("/api/public/mp-selftest")({
  server: {
    handlers: {
      GET: async () => {
        const mp = await import("@/lib/mercadopago.server");
        const out: Record<string, unknown> = {
          configured: mp.isMercadoPagoConfigured(),
          environment: mp.isMercadoPagoConfigured() ? mp.mercadoPagoEnvironment() : null,
        };
        try {
          const pref = await mp.createOrderPreference({
            order: { id: "00000000-0000-4000-8000-000000000001", user_id: "selftest", plan_slug: "trial", amount: 1 },
            planName: "Selftest",
            buyerEmail: "selftest@example.com",
            returnOrigin: "https://www.shadowdashstore.com",
            notificationUrl: "https://www.shadowdashstore.com/api/public/payments/mercadopago",
          });
          out["preference"] = { id: pref.preferenceId, initPoint: pref.initPoint.slice(0, 60) };
        } catch (e) {
          out["preferenceError"] = (e as Error).message;
        }
        try {
          out["search"] = await mp.findApprovedMercadoPagoPayment("00000000-0000-4000-8000-000000000001");
        } catch (e) {
          out["searchError"] = (e as Error).message;
        }
        return Response.json(out);
      },
    },
  },
});
