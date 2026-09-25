CREATE OR REPLACE FUNCTION public.check_index_exists(target_index text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select exists (select 1 from pg_indexes where schemaname='public' and indexname=target_index);
$function$;

REVOKE ALL ON FUNCTION public.check_index_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_index_exists(text) TO service_role;