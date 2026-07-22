
CREATE OR REPLACE FUNCTION public.reactivate_server_licenses_for_user(_user_id uuid, _paid_until timestamptz)
RETURNS SETOF public.licenses
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.licenses l
     SET revoked = false,
         server_overdue_at = NULL,
         server_paid_until = _paid_until::date,
         expires_at = GREATEST(COALESCE(l.expires_at, _paid_until), _paid_until)
   WHERE l.user_id = _user_id
     AND l.disabled_at IS NULL
     AND l.is_trial = false
     AND l.server_overdue_at IS NOT NULL
  RETURNING l.*;
END;
$$;
REVOKE ALL ON FUNCTION public.reactivate_server_licenses_for_user(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_server_licenses_for_user(uuid, timestamptz) TO service_role;
