import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payments/cakto")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleCaktoWebhook } = await import("@/lib/cakto.server");
        return handleCaktoWebhook(request);
      },
    },
  },
});
