import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { trackSchemaFailure } from "./tutorials.functions";

export const getKrakenStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data: input, context }) => {
    const metadata = (input as any)?.metadata || {};
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // 1. Verificar se o usuário já possui uma licença ativa do Kraken
    const fetchLicense = async (client: any) => client
      .from("licenses")
      .select("id, status:revoked, expires_at, created_at, plan_slug")
      .eq("user_id", userId)
      .or(`plan_slug.ilike.%kraken%,plan_slug.ilike.%vitalicio%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let { data: license, error: licenseError } = await fetchLicense(context.supabase);
    
    // Auto-repair if cache fails
    if (licenseError && (licenseError.code === 'PGRST108' || licenseError.message?.includes('schema cache'))) {
      await trackSchemaFailure(licenseError, "getKrakenStatus", false, { stage: "fetch_license", ...metadata }, userId);
      const adminResult = await fetchLicense(supabaseAdmin);
      license = adminResult.data;
      if (!adminResult.error) {
        await trackSchemaFailure(licenseError, "getKrakenStatus", true, { stage: "retry_license_success" }, userId);
      }
    }

    // 2. Verificar o status do pagamento mais recente
    const fetchOrder = async (client: any) => client
      .from("orders")
      .select("id, status, paid_at, created_at, amount, plan_slug")
      .eq("user_id", userId)
      .or(`plan_slug.ilike.%kraken%,plan_slug.ilike.%vitalicio%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let { data: order, error: orderError } = await fetchOrder(context.supabase);

    if (orderError && (orderError.code === 'PGRST108' || orderError.message?.includes('schema cache'))) {
      await trackSchemaFailure(orderError, "getKrakenStatus", false, { stage: "fetch_order", ...metadata }, userId);
      const adminResult = await fetchOrder(supabaseAdmin);
      order = adminResult.data;
      if (!adminResult.error) {
         await trackSchemaFailure(orderError, "getKrakenStatus", true, { stage: "retry_order_success" }, userId);
      }
    }

    // 3. Adicionar lógica de verificação autoritativa para ordens pendentes
    if (order && order.status !== 'paid' && order.status !== 'yaarsa_failed') {
      try {
        const { findApprovedPaymentForOrder } = await import("@/lib/mercadopago.server");
        const approved = await findApprovedPaymentForOrder(order.id, Number(order.amount));
        
        if (approved) {
          // Se encontramos um pagamento aprovado que o webhook ainda não processou, 
          // disparamos o fulfillment em segundo plano e retornamos status positivo.
          const { fulfillOrder } = await import("@/routes/api/public/mp-webhook");
          // fulfillOrder is already robust, we just need to make sure the import is correct.
          // Since it's a server file in a server function, we use the relative path.
          // Não aguardamos o fulfillOrder para não travar a UI, ele é idempotente.
          fulfillOrder(order.id).catch(console.error);
          
          return {
            active: true,
            license: license ? {
              id: license.id,
              expires_at: license.expires_at,
              plan_slug: license.plan_slug,
              is_revoked: license.status
            } : null,
            lastOrder: {
              ...order,
              status: 'paid'
            },
            serverTime: new Date().toISOString(),
            isAuthoritative: true
          };
        }
      } catch (e) {
        console.error("[KrakenStatus] Erro na reconciliação autoritativa:", e);
      }
    }

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
