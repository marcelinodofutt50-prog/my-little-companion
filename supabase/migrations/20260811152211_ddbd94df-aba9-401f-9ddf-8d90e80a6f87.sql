-- Shadow Protocol v45.0: Final Infrastructure Repair
-- Target: Project dvnksmqbpbzwgwmbnjjy (Production)

-- 1. Extend profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_tier TEXT DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 100;

-- 2. Create community_messages
CREATE TABLE IF NOT EXISTS public.community_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Security and Permissions
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT ALL ON public.community_messages TO authenticated;
GRANT ALL ON public.community_messages TO service_role;

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view community messages') THEN
        CREATE POLICY "Anyone can view community messages" 
        ON public.community_messages FOR SELECT 
        TO authenticated 
        USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own messages') THEN
        CREATE POLICY "Users can insert their own messages" 
        ON public.community_messages FOR INSERT 
        TO authenticated 
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 4. Reload PostgREST cache
NOTIFY pgrst, 'reload schema';
