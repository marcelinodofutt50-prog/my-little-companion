REVOKE ALL ON FUNCTION public.generate_my_recovery_codes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_my_recovery_codes() FROM anon;
GRANT EXECUTE ON FUNCTION public.generate_my_recovery_codes() TO authenticated;

NOTIFY pgrst, 'reload schema';