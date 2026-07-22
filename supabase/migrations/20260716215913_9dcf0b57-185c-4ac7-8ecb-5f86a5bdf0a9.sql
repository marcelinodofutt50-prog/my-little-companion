
-- Track when a license was auto-revoked for unpaid server renewal.
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS server_overdue_at timestamptz;

-- Marks every active license whose server_paid_until has passed as revoked
-- and stamps server_overdue_at so the app + admin can distinguish this
-- from a manual revoke. Returns the affected rows so the caller can also
-- suspend the login in Yaarsa via HTTP.
CREATE OR REPLACE FUNCTION public.revoke_unpaid_server_licenses()
RETURNS TABLE(id uuid, user_id uuid, yaarsa_email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.licenses l
     SET revoked = true,
         server_overdue_at = now()
   WHERE l.revoked = false
     AND l.disabled_at IS NULL
     AND l.is_trial = false
     AND l.server_paid_until IS NOT NULL
     AND l.server_paid_until < (now() AT TIME ZONE 'America/Sao_Paulo')::date
  RETURNING l.id, l.user_id, l.yaarsa_email;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_unpaid_server_licenses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_unpaid_server_licenses() TO service_role;

-- Reactivate every server-overdue license for a user (paid renewal).
CREATE OR REPLACE FUNCTION public.reactivate_server_licenses_for_user(_user_id uuid, _paid_until timestamptz)
RETURNS SETOF public.licenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.reactivate_server_licenses_for_user(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reactivate_server_licenses_for_user(uuid, timestamptz) TO service_role;

-- Enable pg_cron so we can schedule the daily job (already commonly on)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
