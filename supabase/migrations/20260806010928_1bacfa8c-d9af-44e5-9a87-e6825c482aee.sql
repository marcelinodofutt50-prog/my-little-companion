CREATE TABLE public.tutorial_progress (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    tutorial_id uuid references public.tutorials(id) on delete cascade not null,
    completed_at timestamptz default now(),
    unique (user_id, tutorial_id)
);

GRANT SELECT, INSERT, DELETE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorial_progress TO service_role;

ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own progress"
ON public.tutorial_progress
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);