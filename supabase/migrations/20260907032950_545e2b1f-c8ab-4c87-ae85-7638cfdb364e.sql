-- 1) Revoga execução direta de funções privilegiadas pela API pública
REVOKE EXECUTE ON FUNCTION public.reactivate_server_licenses_for_user(uuid, timestamptz) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.revoke_unpaid_server_licenses() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.expire_stale_apk_jobs() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.recalc_vip_tier(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_license_quota(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.force_refresh_schema_permissions() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_pgrst_reload() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_rls_enabled(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.calculate_license_status(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.run_community_giveaway(integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.reserve_redeem_code(text, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.release_redeem_code_claim(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.try_acquire_op_lock(text, integer, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.release_op_lock(text) FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.reactivate_server_licenses_for_user(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_unpaid_server_licenses() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_apk_jobs() TO service_role;
GRANT EXECUTE ON FUNCTION public.recalc_vip_tier(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_license_quota(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_pgrst_reload() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_rls_enabled(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_license_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_community_giveaway(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_redeem_code(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_redeem_code_claim(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.try_acquire_op_lock(text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_op_lock(text) TO service_role;

-- 2) search_path fixo nas funções que estavam sem
ALTER FUNCTION public.check_license_consistency() SET search_path = public;
ALTER FUNCTION public.log_license_status_change() SET search_path = public;
ALTER FUNCTION public.is_play_protect_eligible_slug(text) SET search_path = public;
