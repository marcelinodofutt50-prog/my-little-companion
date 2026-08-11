-- 1. Repair profiles table columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'trial_started_at') THEN
        ALTER TABLE public.profiles ADD COLUMN trial_started_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'trial_expires_at') THEN
        ALTER TABLE public.profiles ADD COLUMN trial_expires_at TIMESTAMPTZ;
    END IF;
END $$;

-- 2. Ensure community_messages table exists
CREATE TABLE IF NOT EXISTS public.community_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. Grants and RLS
GRANT SELECT, INSERT ON public.community_messages TO authenticated;
GRANT ALL ON public.community_messages TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.profiles TO authenticated;

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_messages' AND policyname = 'Anyone can view messages') THEN
        CREATE POLICY "Anyone can view messages" ON public.community_messages FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_messages' AND policyname = 'Users can insert their own messages') THEN
        CREATE POLICY "Users can insert their own messages" ON public.community_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 4. Force PostgREST reload
NOTIFY pgrst, 'reload schema';
