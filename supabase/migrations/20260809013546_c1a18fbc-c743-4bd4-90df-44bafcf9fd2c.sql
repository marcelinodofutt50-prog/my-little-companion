-- Shadow Knowledge Base - Reparo Tático de Sincronização v3
-- Reforça permissões, garante estrutura e reconecta o PostgREST ao Shadow Core

-- 1. Estrutura de Tabelas (Garante que a tabela exista e esteja saudável)
CREATE TABLE IF NOT EXISTS public.tutorials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    image_url TEXT,
    youtube_url TEXT,
    category TEXT DEFAULT 'Geral',
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Segurança e Acesso (O PostgREST precisa de permissões explícitas para o cache funcionar)
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

-- Concede permissões para garantir que o Data API consiga ler a tabela
GRANT SELECT ON public.tutorials TO anon;
GRANT SELECT ON public.tutorials TO authenticated;
GRANT ALL ON public.tutorials TO service_role;

-- 3. Políticas de RLS (Garantindo que usuários Trial e Pro consigam ler os dados)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read access' AND tablename = 'tutorials') THEN
        CREATE POLICY "Public read access" ON public.tutorials 
            FOR SELECT TO public 
            USING (is_active = true);
    END IF;
END $$;

-- 4. Função de Reparo Maestro (Drop explícito para evitar conflito de tipo de retorno)
DROP FUNCTION IF EXISTS public.force_refresh_schema_permissions();

CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Força o PostgREST a reavaliar a tabela e suas colunas
    EXECUTE 'ANALYZE public.tutorials';
    
    -- Re-concede permissões para garantir que o cache de segurança seja invalidado
    EXECUTE 'GRANT SELECT ON public.tutorials TO anon, authenticated';
    
    -- Notificação padrão do PostgREST para reload de schema
    NOTIFY pgrst, 'reload schema';
    
    result := jsonb_build_object(
        'status', 'success',
        'message', 'Schema Shadow Core sincronizado',
        'timestamp', now()
    );
    
    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO anon;

-- 5. Seed de Segurança (Garante que o Centro de Treinamento nunca esteja vazio se a sincronização funcionar)
INSERT INTO public.tutorials (title, description, category, display_order, is_active)
VALUES (
    'Guia de Início Rápido', 
    'Aprenda os primeiros passos no ecossistema Shadow e como configurar sua primeira licença.',
    'Básico',
    1,
    true
)
ON CONFLICT DO NOTHING;
