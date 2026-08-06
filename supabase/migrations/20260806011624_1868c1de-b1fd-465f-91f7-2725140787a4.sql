CREATE TABLE IF NOT EXISTS public.tutorials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    image_url TEXT,
    youtube_url TEXT,
    category TEXT DEFAULT 'Geral',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

GRANT SELECT ON public.tutorials TO authenticated;
GRANT ALL ON public.tutorials TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.tutorials TO authenticated;

ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can select active tutorials') THEN
        CREATE POLICY "Anyone can select active tutorials" ON public.tutorials FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage tutorials') THEN
        CREATE POLICY "Admins can manage tutorials" ON public.tutorials FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tutorial_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tutorial_id UUID REFERENCES public.tutorials(id) ON DELETE CASCADE NOT NULL,
    watched_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, tutorial_id)
);

GRANT SELECT, INSERT, DELETE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorial_progress TO service_role;

ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own progress') THEN
        CREATE POLICY "Users can manage their own progress" ON public.tutorial_progress FOR ALL TO authenticated USING (auth.uid() = user_id);
    END IF;
END $$;

INSERT INTO public.tutorials (title, description, category, youtube_url)
SELECT 'Introdução ao Shadow BTMOB', 'Aprenda os conceitos básicos da plataforma Shadow.', 'Iniciante', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
WHERE NOT EXISTS (SELECT 1 FROM public.tutorials WHERE title = 'Introdução ao Shadow BTMOB');

INSERT INTO public.tutorials (title, description, category, youtube_url)
SELECT 'Configurando o Shadow Signer', 'Guia passo a passo para configurar sua ferramenta de assinatura.', 'Segurança', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
WHERE NOT EXISTS (SELECT 1 FROM public.tutorials WHERE title = 'Configurando o Shadow Signer');

INSERT INTO public.tutorials (title, description, category, youtube_url)
SELECT 'Bypass Avançado de Play Protect', 'Técnicas modernas para contornar verificações de segurança.', 'Avançado', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
WHERE NOT EXISTS (SELECT 1 FROM public.tutorials WHERE title = 'Bypass Avançado de Play Protect');

INSERT INTO public.tutorials (title, description, category, youtube_url)
SELECT 'Gestão de Licenças e Terminais', 'Como gerenciar seus acessos e dispositivos ativos.', 'Geral', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
WHERE NOT EXISTS (SELECT 1 FROM public.tutorials WHERE title = 'Gestão de Licenças e Terminais');