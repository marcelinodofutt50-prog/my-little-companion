import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyRenewalOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("licenses")
      .select("id, yaarsa_email, panel, is_legacy, server_paid_until")
      .eq("user_id", context.userId).eq("is_trial", false).is("disabled_at", null)
      .order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error("Não foi possível carregar seus logins. Tente novamente.");
    const { data: plans, error: planError } = await context.supabase.from("plans")
      .select("slug, price_brl").in("slug", ["server-monthly", "server-monthly-legacy"]).eq("active", true);
    if (planError) throw new Error("Não foi possível consultar os planos de renovação.");
    return (data ?? []).map((license) => {
      const slug = license.is_legacy ? "server-monthly-legacy" : "server-monthly";
      const plan = plans?.find((p) => p.slug === slug);
      return { ...license, planSlug: slug, price: plan ? Number(plan.price_brl) : null };
    });
  });