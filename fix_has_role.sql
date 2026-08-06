-- Check if has_role exists and fix it if needed
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Ensure tutorials are visible to all authenticated users for now to debug
DROP POLICY IF EXISTS "Anyone can select active tutorials" ON public.tutorials;
CREATE POLICY "Anyone can select active tutorials" ON public.tutorials FOR SELECT TO authenticated USING (true);
