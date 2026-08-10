-- Garantir acesso total ao schema public para os roles necessários
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Reforçar permissões específicas nas tabelas de tutoriais
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;

-- Recarregar cache de esquema de forma agressiva
NOTIFY pgrst, 'reload schema';