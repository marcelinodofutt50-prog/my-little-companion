-- Shadow Audit v10.0: Re-sincronização de privilégios e colunas críticas
-- Força a presença das colunas e garante permissões para evitar "Falha ao atualizar"

DO $$ 
BEGIN
    -- 1. Garantir que as colunas existam na tabela profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'metadata') THEN
        ALTER TABLE public.profiles ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'vip_tier') THEN
        -- Verifica se o tipo vip_tier existe antes de tentar adicionar a coluna
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vip_tier') THEN
            ALTER TABLE public.profiles ADD COLUMN vip_tier public.vip_tier DEFAULT 'none';
        ELSE
            ALTER TABLE public.profiles ADD COLUMN vip_tier text DEFAULT 'none';
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'reputation_score') THEN
        ALTER TABLE public.profiles ADD COLUMN reputation_score INTEGER DEFAULT 100;
    END IF;
END $$;

-- 2. Garantir permissões de escrita para usuários autenticados
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 3. Garantir permissões nas tabelas de fidelidade e chat
-- Usando EXCEPTION block para tabelas que podem não existir ainda
DO $$ BEGIN
    GRANT SELECT, INSERT, UPDATE ON public.community_messages TO authenticated;
    GRANT ALL ON public.community_messages TO service_role;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    GRANT SELECT, INSERT, UPDATE ON public.loyalty_history TO authenticated;
    GRANT ALL ON public.loyalty_history TO service_role;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    GRANT SELECT, UPDATE ON public.user_loyalty TO authenticated;
    GRANT ALL ON public.user_loyalty TO service_role;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 4. Notificar PostgREST para recarregar o cache imediatamente
NOTIFY pgrst, 'reload schema';
