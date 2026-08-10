-- Forçar atualização do cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- Re-aplicar permissões básicas caso tenham sido perdidas
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.tutorials TO anon, authenticated;
GRANT SELECT ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorials TO service_role;
GRANT ALL ON public.tutorial_progress TO service_role;

-- Garantir que a tabela existe (fallback)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tutorials') THEN
        CREATE TABLE public.tutorials (
            id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            title text NOT NULL,
            description text NOT NULL,
            video_url text,
            youtube_url text,
            image_url text,
            category text NOT NULL DEFAULT 'Geral',
            display_order integer NOT NULL DEFAULT 0,
            is_active boolean NOT NULL DEFAULT true,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now(),
            created_by uuid
        );
        GRANT SELECT ON public.tutorials TO anon, authenticated;
        GRANT ALL ON public.tutorials TO service_role;
        ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Allow public read" ON public.tutorials FOR SELECT USING (true);
    END IF;
END $$;
