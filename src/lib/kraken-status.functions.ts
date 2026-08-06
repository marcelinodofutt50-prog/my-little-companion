import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getKrakenStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // 1. Verificar se o usuário já possui uma licença ativa do Kraken
    // Baseado no mapping do fulfillOrder, Kraken planos levam para v46 ou v457.
    // O usuário quer saber o status especificamente da "Kraken 2.0".
    const { data: license } = await supabaseAdmin
      .from("licenses")
      .select("id, status:revoked, expires_at, created_at, plan_slug")
      .eq("user_id", userId)
      .like("plan_slug", "%kraken%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Verificar o status do pagamento mais recente para Kraken (se não tiver licença ativa ou para info de processamento)
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, paid_at, created_at, amount, plan_slug")
      .eq("user_id", userId)
      .like("plan_slug", "%kraken%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      active: !!license && !license.status,
      license: license ? {
        id: license.id,
        expires_at: license.expires_at,
        plan_slug: license.plan_slug,
        is_revoked: license.status
      } : null,
      lastOrder: order ? {
        id: order.id,
        status: order.status,
        paid_at: order.paid_at,
        plan_slug: order.plan_slug
      } : null,
      serverTime: new Date().toISOString()
    };
  });
