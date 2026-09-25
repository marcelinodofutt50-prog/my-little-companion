REVOKE EXECUTE ON FUNCTION public.complete_loyalty_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_loyalty_mission(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_active_play_protect(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_play_protect(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;