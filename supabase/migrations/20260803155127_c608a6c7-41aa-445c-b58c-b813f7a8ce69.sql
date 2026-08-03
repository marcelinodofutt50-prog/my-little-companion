GRANT SELECT, INSERT, UPDATE ON TABLE public.support_threads TO authenticated;
GRANT SELECT, INSERT ON TABLE public.support_messages TO authenticated;
GRANT ALL ON TABLE public.support_threads TO service_role;
GRANT ALL ON TABLE public.support_messages TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;