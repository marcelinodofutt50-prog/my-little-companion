-- Auditoria de colunas e permissões
SELECT 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    table_name = 'support_messages' 
    AND column_name = 'reply_to_id';

-- Verificar se RLS está habilitado e se existem políticas
SELECT 
    tablename, 
    rowsecurity 
FROM 
    pg_tables 
WHERE 
    tablename IN ('support_messages', 'apk_build_jobs');

-- Re-aplicar GRANTs de segurança para garantir acesso do API
GRANT ALL ON public.apk_build_jobs TO authenticated;
GRANT ALL ON public.apk_build_jobs TO service_role;
GRANT ALL ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
GRANT ALL ON public.support_threads TO authenticated;
GRANT ALL ON public.support_threads TO service_role;
GRANT ALL ON public.trials TO authenticated;
GRANT ALL ON public.trials TO service_role;

-- Garantir que as tabelas de build existem (caso tenham sido dropadas acidentalmente)
CREATE TABLE IF NOT EXISTS public.apk_dropper_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.apk_build_jobs(id) ON DELETE CASCADE NOT NULL,
    dropper_type TEXT NOT NULL,
    config_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON public.apk_dropper_configs TO authenticated;
GRANT ALL ON public.apk_dropper_configs TO service_role;
