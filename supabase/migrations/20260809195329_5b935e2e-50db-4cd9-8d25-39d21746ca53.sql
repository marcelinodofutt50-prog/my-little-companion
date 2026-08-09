-- Shadow Infrastructure Evolution v7.4
-- Fix for PGRST108 and Missing Columns/Tables

-- 1. Ensure 'metadata' column exists in 'profiles'
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='metadata') THEN
        ALTER TABLE public.profiles ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Ensure 'community_messages' table exists
CREATE TABLE IF NOT EXISTS public.community_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT ON public.community_messages TO authenticated;
GRANT ALL ON public.community_messages TO service_role;

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_messages' AND policyname = 'Anyone authenticated can read messages') THEN
        CREATE POLICY "Anyone authenticated can read messages" ON public.community_messages FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_messages' AND policyname = 'Users can insert their own messages') THEN
        CREATE POLICY "Users can insert their own messages" ON public.community_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 3. Ensure 'tutorial_progress' exists and is correctly structured
CREATE TABLE IF NOT EXISTS public.tutorial_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tutorial_id UUID REFERENCES public.tutorials(id) ON DELETE CASCADE NOT NULL,
    completed BOOLEAN DEFAULT false,
    last_watched_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tutorial_id)
);

GRANT SELECT, INSERT, UPDATE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorial_progress TO service_role;

ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tutorial_progress' AND policyname = 'Users can manage their own progress') THEN
        CREATE POLICY "Users can manage their own progress" ON public.tutorial_progress FOR ALL TO authenticated USING (auth.uid() = user_id);
    END IF;
END $$;

-- 4. Force Schema Refresh
NOTIFY pgrst, 'reload schema';
SELECT pg_sleep(1); -- Brief wait for signal
ANALYZE public.profiles;
ANALYZE public.community_messages;
ANALYZE public.tutorial_progress;
ANALYZE public.tutorials;
