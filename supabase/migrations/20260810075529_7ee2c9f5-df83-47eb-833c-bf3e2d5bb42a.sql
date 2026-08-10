-- Final Repair Script for Shadow Infrastructure
-- 1. Correct Columns for Profiles
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'metadata') THEN
    ALTER TABLE public.profiles ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'vip_tier') THEN
    ALTER TABLE public.profiles ADD COLUMN vip_tier text DEFAULT 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'reputation_score') THEN
    ALTER TABLE public.profiles ADD COLUMN reputation_score integer DEFAULT 100;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'display_name') THEN
    ALTER TABLE public.profiles ADD COLUMN display_name text;
  END IF;
END $$;

-- 2. Repair Community Messages
CREATE TABLE IF NOT EXISTS public.community_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content text NOT NULL,
    is_anonymous boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- 3. Sync Grants (CRITICAL for PostgREST)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_messages TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.community_messages TO service_role;

-- 4. RLS Re-Enablement
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- 5. Fix Policies (Drop and Recreate to ensure correct definition)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Community messages are viewable by everyone" ON public.community_messages;
CREATE POLICY "Community messages are viewable by everyone" ON public.community_messages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own messages" ON public.community_messages;
CREATE POLICY "Users can insert own messages" ON public.community_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 6. Trigger Schema Refresh
NOTIFY pgrst, 'reload schema';