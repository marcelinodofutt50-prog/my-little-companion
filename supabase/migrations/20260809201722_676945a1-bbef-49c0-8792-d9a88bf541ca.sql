-- 1. Assegurar que as colunas existem na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_tier TEXT DEFAULT 'none';

-- 2. Garantir permissões de atualização para o usuário autenticado
-- O Supabase Data API precisa que as colunas sejam explicitamente garantidas se RLS for restritiva
GRANT SELECT, UPDATE(metadata, display_name) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 3. Forçar o PostgREST a recarregar o schema
-- Isso é crucial quando colunas são adicionadas mas não aparecem no cache (PGRST108)
NOTIFY pgrst, 'reload schema';

-- 4. Função auxiliar para refresh forçado via RPC se o notify não for suficiente
CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Tenta invalidar o cache de permissões e schema
  NOTIFY pgrst, 'reload schema';
  -- Uma pequena noop para garantir execução
  PERFORM 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO service_role;
