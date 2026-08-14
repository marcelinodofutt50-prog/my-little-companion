CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'moderator')
      OR public.has_role(_user_id, 'support');
$$;