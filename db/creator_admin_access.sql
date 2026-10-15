CREATE OR REPLACE FUNCTION public.is_approved_creator(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    EXISTS (SELECT 1 FROM supporter_applications WHERE user_id = _uid AND status = 'approved')
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = _uid AND role::text = 'admin')
  ) AND NOT public.is_account_banned(_uid)
$$;
REVOKE ALL ON FUNCTION public.is_approved_creator(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_creator(uuid) TO authenticated;
