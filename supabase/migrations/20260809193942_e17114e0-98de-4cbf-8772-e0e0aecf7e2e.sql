-- 1. Garante a coluna metadata na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 2. Garante que a tabela tutorials existe (base para o progresso)
CREATE TABLE IF NOT EXISTS public.tutorials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    video_url text,
    display_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Recria/Garante tutorial_progress
CREATE TABLE IF NOT EXISTS public.tutorial_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tutorial_id uuid REFERENCES public.tutorials(id) ON DELETE CASCADE NOT NULL,
    completed_at timestamptz DEFAULT now(),
    UNIQUE(user_id, tutorial_id)
);

-- 4. Permissões (Grants)
GRANT SELECT ON public.tutorials TO authenticated;
GRANT ALL ON public.tutorials TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorial_progress TO service_role;

-- 5. Segurança (RLS)
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view tutorials" ON public.tutorials;
CREATE POLICY "Anyone authenticated can view tutorials"
ON public.tutorials FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can manage their own progress" ON public.tutorial_progress;
CREATE POLICY "Users can manage their own progress"
ON public.tutorial_progress
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Forçar atualização do cache do PostgREST
NOTIFY pgrst, 'reload schema';
