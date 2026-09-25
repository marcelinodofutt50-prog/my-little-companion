REVOKE ALL ON FUNCTION public.check_index_exists(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_index_exists(text) TO service_role;