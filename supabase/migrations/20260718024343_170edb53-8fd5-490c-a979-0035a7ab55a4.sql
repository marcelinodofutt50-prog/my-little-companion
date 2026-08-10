DROP FUNCTION IF EXISTS public.revoke_unpaid_server_licenses();

CREATE OR REPLACE FUNCTION public.revoke_unpaid_server_licenses()
 RETURNS TABLE(id uuid, user_id uuid, yaarsa_email text, panel text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  RETURNING l.id, l.user_id, l.yaarsa_email, l.panel::text;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.revoke_unpaid_server_licenses() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_unpaid_server_licenses() TO service_role;