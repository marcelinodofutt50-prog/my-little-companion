
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS paid_externally boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_externally_until date,
  ADD COLUMN IF NOT EXISTS paid_externally_marked_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_externally_last_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_externally_last_check_status text;

CREATE INDEX IF NOT EXISTS licenses_paid_externally_idx
  ON public.licenses (paid_externally, paid_externally_until)
  WHERE paid_externally = true;

-- Skip revocation for externally-paid licenses so the day-20 cron never touches them.
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
     AND l.paid_externally = false
     AND l.server_paid_until IS NOT NULL
     AND l.server_paid_until < (now() AT TIME ZONE 'America/Sao_Paulo')::date
  RETURNING l.id, l.user_id, l.yaarsa_email, l.panel::text;
END;
$function$;
