-- Tactical Schema Audit and Fix v8.4
-- Focusing on absolute column existence and permissions for shadow ecosystem

-- 1. Hardening PROFILES table
DO $$ 
BEGIN
    -- profiles.metadata
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'metadata') THEN
        ALTER TABLE public.profiles ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- profiles.vip_tier
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'vip_tier') THEN
        ALTER TABLE public.profiles ADD COLUMN vip_tier TEXT DEFAULT 'none';
    END IF;

    -- profiles.reputation_score
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'reputation_score') THEN
        ALTER TABLE public.profiles ADD COLUMN reputation_score INTEGER DEFAULT 100;
    END IF;

    -- profiles.conversions_count
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'conversions_count') THEN
        ALTER TABLE public.profiles ADD COLUMN conversions_count INTEGER DEFAULT 0;
    END IF;

    -- profiles.referrals_valid_count
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'referrals_valid_count') THEN
        ALTER TABLE public.profiles ADD COLUMN referrals_valid_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. Ensuring TUTORIALS and PROGRESS exist
CREATE TABLE IF NOT EXISTS public.tutorials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    image_url TEXT,
    youtube_url TEXT,
    category TEXT DEFAULT 'General',
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.tutorial_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tutorial_id UUID REFERENCES public.tutorials(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tutorial_id)
);

-- 3. Community and Goals
CREATE TABLE IF NOT EXISTS public.community_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    target_members INTEGER NOT NULL,
    achieved_at TIMESTAMPTZ,
    reward_points INTEGER DEFAULT 0
);

-- 4. GRANTS (CRITICAL)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.profiles TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorials TO authenticated;
GRANT ALL ON public.tutorials TO service_role;
GRANT SELECT ON public.tutorials TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorial_progress TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_messages TO authenticated;
GRANT ALL ON public.community_messages TO service_role;
GRANT SELECT ON public.community_messages TO anon;

GRANT SELECT ON public.community_goals TO authenticated;
GRANT ALL ON public.community_goals TO service_role;
GRANT SELECT ON public.community_goals TO anon;

-- 5. RLS POLICIES (Hardened)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tutorials are viewable by everyone" ON public.tutorials;
CREATE POLICY "Tutorials are viewable by everyone" ON public.tutorials FOR SELECT USING (is_active = true);

ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own progress" ON public.tutorial_progress;
CREATE POLICY "Users can view own progress" ON public.tutorial_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own progress" ON public.tutorial_progress;
CREATE POLICY "Users can insert own progress" ON public.tutorial_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own progress" ON public.tutorial_progress;
CREATE POLICY "Users can delete own progress" ON public.tutorial_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Messages are viewable by everyone" ON public.community_messages;
CREATE POLICY "Messages are viewable by everyone" ON public.community_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert messages" ON public.community_messages;
CREATE POLICY "Users can insert messages" ON public.community_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 6. Schema Cache Forced Refresh NOTIFY
NOTIFY pgrst, 'reload schema';
