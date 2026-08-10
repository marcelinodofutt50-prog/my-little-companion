
CREATE OR REPLACE FUNCTION public.has_active_play_protect(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.licenses l
    WHERE l.user_id = _user_id
      AND (auth.uid() = _user_id OR public.has_role(auth.uid(), 'admin'))
      AND l.plan_slug = 'play-protect-monthly'
      AND l.disabled_at IS NULL
      AND l.revoked = false
      AND (l.expires_at IS NULL OR l.expires_at > now())
  );
$$;
