-- Adiciona a coluna metadata se ela não existir (proteção contra cache cache antigo/divergente)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'metadata') THEN
        ALTER TABLE public.profiles ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Garante que tutorial_progress existe e tem RLS correto
CREATE TABLE IF NOT EXISTS public.tutorial_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tutorial_id uuid REFERENCES public.tutorials(id) ON DELETE CASCADE NOT NULL,
    completed_at timestamptz DEFAULT now(),
    UNIQUE(user_id, tutorial_id)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorial_progress TO service_role;

-- RLS
ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own progress"
ON public.tutorial_progress
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Força atualização do PostgREST
NOTIFY pgrst, 'reload schema';
