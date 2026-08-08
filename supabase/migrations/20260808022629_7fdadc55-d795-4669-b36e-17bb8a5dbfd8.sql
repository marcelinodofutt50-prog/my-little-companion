DROP TABLE IF EXISTS public.tutorials CASCADE;
CREATE TABLE public.tutorials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    image_url TEXT,
    youtube_url TEXT,
    category TEXT DEFAULT 'general',
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorials TO authenticated;
GRANT ALL ON public.tutorials TO service_role;
GRANT SELECT ON public.tutorials TO anon;
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de tutoriais" ON public.tutorials FOR SELECT TO public USING (is_active = true);
CREATE POLICY "Gestão de tutoriais por Staff" ON public.tutorials FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN NOTIFY pgrst, 'reload schema'; EXECUTE 'SELECT count(*) FROM tutorials'; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Falha ao forçar refresh de schema: %', SQLERRM; END; $$;
INSERT INTO public.tutorials (title, description, category, display_order) VALUES ('Bem-vindo ao Shadow', 'Inicie sua jornada configurando o ambiente tático.', 'Início', 1);