/**
 * Acesso tolerante ao cliente de serviço.
 *
 * O `supabaseAdmin` gerado lança uma exceção assim que é tocado quando as
 * variáveis do backend não estão configuradas no ambiente (ex.: deploy externo
 * sem a chave de serviço). Isso quebrava fluxos que já tinham um plano B com o
 * cliente do próprio usuário. Aqui devolvemos `null` em vez de estourar, para
 * que cada chamador possa cair no fallback com RLS.
 */
export async function getSupabaseAdminSafe(): Promise<any | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Toca o proxy para forçar a criação do cliente agora (e capturar o erro aqui).
    void supabaseAdmin.from;
    return supabaseAdmin;
  } catch (error: any) {
    console.error("[SupabaseAdmin] indisponível:", error?.message ?? error);
    return null;
  }
}
