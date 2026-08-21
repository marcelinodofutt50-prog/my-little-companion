REVOKE ALL ON FUNCTION public.try_acquire_op_lock(text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_op_lock(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_op_lock(text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_op_lock(text) TO service_role;