
-- Revoke default EXECUTE on all SECURITY DEFINER functions from anon/authenticated,
-- then grant back only where the app legitimately needs it.
-- Trigger functions don't need EXECUTE grants (triggers run as their owner).

REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_support_msg_admin_flag() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_unpaid_server_licenses() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reactivate_server_licenses_for_user(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- has_role is called from the browser (e.g. dashboard admin-badge check) so
-- signed-in users still need EXECUTE; anon does not.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Server-only functions: service_role must retain access for edge/cron/webhook paths.
GRANT EXECUTE ON FUNCTION public.revoke_unpaid_server_licenses() TO service_role;
GRANT EXECUTE ON FUNCTION public.reactivate_server_licenses_for_user(uuid, timestamptz) TO service_role;
