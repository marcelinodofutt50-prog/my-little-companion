-- Garantir que a tabela user_roles seja acessível pelo client autenticado para o fetchMyRole (mesmo com SECURITY DEFINER has_role, a leitura direta pode ser necessária em fallbacks)
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- Recarregar schema
NOTIFY pgrst, 'reload schema';