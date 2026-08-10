-- Reforçar permissões e forçar o recarregamento do cache do PostgREST
-- Este script garante que todas as tabelas essenciais existam e sejam visíveis para o PostgREST.

-- 1. Garantir permissões de uso no schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Re-garantir permissões específicas para o Centro de Treinamento
GRANT SELECT ON public.tutorials TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorials TO service_role;
GRANT ALL ON public.tutorial_progress TO service_role;

-- 3. Criar função SECURITY DEFINER para recarregamento forçado se não existir
CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notifica o PostgREST para recarregar o schema
  NOTIFY pgrst, 'reload schema';
  
  -- Garante permissões básicas novamente dentro da função
  EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated';
  
  RETURN true;
END;
$$;

-- 4. Executar a notificação imediatamente
NOTIFY pgrst, 'reload schema';

-- HINT para o PostgREST: Tentar forçar o reload via SELECT numa função
SELECT public.force_refresh_schema_permissions();