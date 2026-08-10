/**
 * Escolhe o melhor client para leituras administrativas.
 *
 * Em alguns ambientes (ex.: deploy sem SUPABASE_SERVICE_ROLE_KEY, ou chave
 * no formato novo `sb_secret_*` que o Data API rejeita) o client de serviço
 * falha silenciosamente e as listagens do painel voltam vazias — mesmo com
 * os contadores/badges mostrando itens pendentes.
 *
 * Aqui fazemos um "probe" barato: se o client admin responder, usamos ele;
 * caso contrário caímos para o client autenticado do próprio admin (as
 * policies de RLS já permitem leitura para quem tem role admin).
 */
export async function pickAdminClient(userClient: any): Promise<{ db: any; usedAdmin: boolean }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("support_threads")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (error) throw new Error(error.message);
    return { db: supabaseAdmin, usedAdmin: true };
  } catch (e) {
    console.warn("[admin-read] service client indisponível, usando client do admin:", (e as Error)?.message);
    return { db: userClient, usedAdmin: false };
  }
}
