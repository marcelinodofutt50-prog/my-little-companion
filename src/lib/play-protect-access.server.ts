/**
 * Fonte única de verdade do acesso ao Bypass Play Protect.
 *
 * Antes isso dependia exclusivamente da RPC `has_active_play_protect`, que em
 * alguns ambientes está numa versão antiga (só olha licenças) — resultado:
 * concessões manuais de dias (admin) simplesmente não liberavam a fila.
 * Aqui checamos direto as duas fontes com o cliente de serviço.
 */
const PP_SLUGS = [
  "play-protect-monthly",
  "monthly_457",
  "lifetime_46",
  "kraken-monthly",
  "kraken-lifetime",
  "upgrade_v46",
  "upgrade-457-to-46",
];

export async function hasActivePlayProtect(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const nowIso = new Date().toISOString();

  const [grantRes, licRes] = await Promise.all([
    supabaseAdmin
      .from("play_protect_grants")
      .select("id")
      .eq("user_id", userId)
      .gt("expires_at", nowIso)
      .limit(1),
    supabaseAdmin
      .from("licenses")
      .select("id, plan_slug, expires_at, revoked, disabled_at")
      .eq("user_id", userId)
      .eq("revoked", false)
      .is("disabled_at", null)
      .in("plan_slug", PP_SLUGS),
  ]);

  if ((grantRes.data?.length ?? 0) > 0) return true;

  const now = Date.now();
  return (licRes.data ?? []).some(
    (l: any) => !l.expires_at || new Date(l.expires_at).getTime() > now,
  );
}
