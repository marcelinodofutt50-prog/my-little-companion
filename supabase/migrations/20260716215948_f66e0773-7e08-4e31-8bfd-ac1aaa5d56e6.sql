
REVOKE EXECUTE ON FUNCTION public.revoke_unpaid_server_licenses() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reactivate_server_licenses_for_user(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
