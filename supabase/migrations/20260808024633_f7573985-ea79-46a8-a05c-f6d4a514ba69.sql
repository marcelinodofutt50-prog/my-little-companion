CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Force PostgREST to notice the tables by re-granting
    GRANT SELECT ON public.tutorials TO anon, authenticated;
    GRANT SELECT ON public.tutorial_progress TO authenticated;
    GRANT SELECT ON public.user_roles TO authenticated;
    GRANT SELECT ON public.profiles TO authenticated;
    GRANT SELECT ON public.orders TO authenticated;
    GRANT SELECT ON public.licenses TO authenticated;
    
    -- "Touch" the relations to update statistics/cache
    ANALYZE public.tutorials;
    ANALYZE public.tutorial_progress;
    ANALYZE public.user_roles;
    ANALYZE public.profiles;
    ANALYZE public.orders;
    ANALYZE public.licenses;
    
    -- Notify PostgREST to reload schema cache
    NOTIFY pgrst, 'reload schema';
END;
$function$;

-- Garantir que a função possa ser chamada por qualquer usuário autenticado para auto-reparo
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated, anon;
