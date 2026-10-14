CREATE OR REPLACE FUNCTION public.sync_admin_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'moderator'), (NEW.user_id, 'support')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_admin_roles ON public.user_roles;
CREATE TRIGGER trg_sync_admin_roles
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_admin_roles();

INSERT INTO public.user_roles (user_id, role)
SELECT ur.user_id, r.role
FROM public.user_roles ur
CROSS JOIN (VALUES ('moderator'::public.app_role), ('support'::public.app_role)) AS r(role)
WHERE ur.role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;