-- Pausa de login v2: data de retorno, limite 1x/mês e taxa do servidor congelada.
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS pause_until timestamptz;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS last_pause_started_at timestamptz;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS server_paid_until_before_suspend timestamptz;

-- Licença pausada não é cortada por falta de pagamento do servidor: os dias
-- da taxa ficam congelados e voltam empurrados no despause.
CREATE OR REPLACE FUNCTION public.revoke_unpaid_server_licenses()
 RETURNS TABLE(id uuid, user_id uuid, yaarsa_email text, panel text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE public.licenses l
     SET revoked = true, server_overdue_at = now()
   WHERE l.revoked = false AND l.disabled_at IS NULL AND l.is_trial = false
     AND l.paid_externally = false
     AND l.suspended_at IS NULL
     AND l.server_paid_until IS NOT NULL
     AND l.server_paid_until < (now() AT TIME ZONE 'America/Sao_Paulo')::date
  RETURNING l.id, l.user_id, l.yaarsa_email, l.panel::text;
END;
$function$;
