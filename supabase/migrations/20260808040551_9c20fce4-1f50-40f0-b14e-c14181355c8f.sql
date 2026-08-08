-- Re-executando tática de reparo profundo para a tabela tutorials
DO $$ 
BEGIN
    GRANT SELECT ON public.tutorials TO anon, authenticated;
    GRANT ALL ON public.tutorials TO service_role;
END $$;

CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    row_count int;
BEGIN
    SELECT count(*) INTO row_count FROM public.tutorials;
    GRANT SELECT ON public.tutorials TO anon, authenticated;
    GRANT ALL ON public.tutorials TO service_role;
    NOTIFY pgrst, 'reload schema';
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated, anon, service_role;
SELECT public.force_refresh_schema_permissions();