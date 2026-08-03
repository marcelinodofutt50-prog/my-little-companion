-- Garantir que a tabela existe e tem a estrutura correta
CREATE TABLE IF NOT EXISTS public.apk_build_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    app_name TEXT NOT NULL,
    original_apk_url TEXT NOT NULL,
    original_icon_url TEXT,
    output_apk_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.apk_build_jobs ENABLE ROW LEVEL SECURITY;

-- Permissões
GRANT ALL ON public.apk_build_jobs TO authenticated;
GRANT ALL ON public.apk_build_jobs TO service_role;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'apk_build_jobs' AND policyname = 'Users can view their own jobs') THEN
        CREATE POLICY "Users can view their own jobs" ON public.apk_build_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'apk_build_jobs' AND policyname = 'Users can insert their own jobs') THEN
        CREATE POLICY "Users can insert their own jobs" ON public.apk_build_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Garantir colunas no suporte
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='support_messages' AND column_name='reply_to_id') THEN
        ALTER TABLE public.support_messages ADD COLUMN reply_to_id UUID REFERENCES public.support_messages(id);
    END IF;
END $$;

GRANT ALL ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
GRANT ALL ON public.support_threads TO authenticated;
GRANT ALL ON public.support_threads TO service_role;
