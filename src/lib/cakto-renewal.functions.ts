import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCaktoRenewalCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ orderId: z.string().uuid(), open: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order, error: orderError } = await supabase.from("orders")
      .select("plan_slug,amount,status,metadata")
      .eq("id", data.orderId).eq("user_id", userId).maybeSingle();
    if (orderError) throw new Error("Não foi possível verificar o pedido de renovação.");
    if (!order || !["server-monthly", "server-monthly-legacy"].includes(order.plan_slug)) return null;

    const targetId = z.object({ target_license_id: z.string().uuid() }).passthrough().safeParse(order.metadata);
    if (!targetId.success) return null;
    const { data: license, error: licenseError } = await supabase.from("licenses")
      .select("plan_slug,panel,is_legacy,is_trial,disabled_at")
      .eq("id", targetId.data.target_license_id).eq("user_id", userId).maybeSingle();
    if (licenseError) throw new Error("Não foi possível verificar o login da renovação.");
    if (!license) return null;

    const { resolveCaktoRenewalOffer } = await import("./cakto-renewal.server");
    const offer = resolveCaktoRenewalOffer({ ...order, amount: Number(order.amount) }, license);
    if (!offer) return null;
    return { label: offer.label, amount: offer.amount, cadence: "/mês", url: data.open ? offer.url : null };
  });
