import { welcomePriceFor } from "./welcome-offer";

/**
 * Preço de boas-vindas conferido no servidor pela data de cadastro do próprio
 * login (não confia no navegador). Contas banidas não recebem a oferta.
 */
export async function serverWelcomePrice(userId: string, planSlug: string, basePrice: number): Promise<number | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const createdAt = data?.user?.created_at ?? null;
    const price = welcomePriceFor(planSlug, basePrice, createdAt);
    if (price === null) return null;
    const { getActiveBan } = await import("./ban-engine.server");
    if (await getActiveBan(userId)) return null;
    return price;
  } catch (e) {
    console.error("[welcome-offer] check failed", e);
    return null;
  }
}
