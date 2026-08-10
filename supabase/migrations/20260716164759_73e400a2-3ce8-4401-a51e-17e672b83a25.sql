
CREATE OR REPLACE FUNCTION public.enforce_support_msg_admin_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Force is_admin to reflect the caller's real role. Non-admins cannot
  -- impersonate admin/staff by passing is_admin=true from the client.
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support') THEN
    NEW.is_admin := COALESCE(NEW.is_admin, false);
  ELSE
    NEW.is_admin := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_support_msg_admin_flag ON public.support_messages;
CREATE TRIGGER trg_enforce_support_msg_admin_flag
BEFORE INSERT OR UPDATE ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_support_msg_admin_flag();
