
CREATE OR REPLACE FUNCTION public.enforce_support_msg_admin_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator') THEN
    NEW.is_admin := COALESCE(NEW.is_admin, false);
  ELSE
    NEW.is_admin := false;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_support_msg_admin_flag() FROM PUBLIC, anon, authenticated;
