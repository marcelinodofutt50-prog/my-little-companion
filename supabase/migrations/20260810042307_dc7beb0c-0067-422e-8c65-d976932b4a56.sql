-- Shadow Protocol v12.0: Reparo Definitivo de Infraestrutura Shadow Pass
-- 1. Garantir colunas críticas na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS vip_tier TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 0;

-- 2. Garantir tabela de mensagens da comunidade e chaves estrangeiras
CREATE TABLE IF NOT EXISTS public.community_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    is_anonymous BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Corrigir restrição de chave estrangeira se necessário para o PostgREST
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'community_messages_user_id_fkey'
    ) THEN
        ALTER TABLE public.community_messages 
        ADD CONSTRAINT community_messages_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id);
    END IF;
END $$;

-- 3. Configurar Permissões (GRANT) - CRITICAL para TanStack Start / PostgREST
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.community_messages TO authenticated;
GRANT ALL ON public.community_messages TO service_role;

-- 4. Habilitar RLS e Criar Políticas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- Políticas para Profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT TO authenticated
    USING (true);

-- Políticas para Community Messages
DROP POLICY IF EXISTS "Anyone can view messages" ON public.community_messages;
CREATE POLICY "Anyone can view messages" ON public.community_messages
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can insert messages" ON public.community_messages;
CREATE POLICY "Users can insert messages" ON public.community_messages
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 5. Forçar recarregamento do cache do PostgREST
NOTIFY pgrst, 'reload schema';
