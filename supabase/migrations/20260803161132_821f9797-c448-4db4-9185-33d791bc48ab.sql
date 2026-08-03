CREATE OR REPLACE FUNCTION public.enforce_support_msg_admin_flag()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Mensagens do sistema/IA são gravadas pelo backend (sem auth.uid()) e devem
  -- permanecer marcadas como suporte.
  IF NEW.is_system AND auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.is_staff(auth.uid()) THEN
    NEW.is_admin := COALESCE(NEW.is_admin, false);
  ELSE
    NEW.is_admin := false;
  END IF;
  RETURN NEW;
END; $function$;