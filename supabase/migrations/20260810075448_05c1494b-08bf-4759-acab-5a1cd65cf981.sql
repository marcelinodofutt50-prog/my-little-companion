-- 1. Ensure columns exist on profiles
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'metadata') THEN
    ALTER TABLE public.profiles ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'vip_tier') THEN
    ALTER TABLE public.profiles ADD COLUMN vip_tier text DEFAULT 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'reputation_score') THEN
    ALTER TABLE public.profiles ADD COLUMN reputation_score integer DEFAULT 100;
  END IF;
END $$;

-- 2. Ensure community_messages table exists with proper structure
CREATE TABLE IF NOT EXISTS public.community_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content text NOT NULL,
    is_anonymous boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- 3. Set Permissions and RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_messages TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.community_messages TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Profiles are viewable by everyone') THEN
        CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- Policies for community_messages
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_messages' AND policyname = 'Community messages are viewable by everyone') THEN
        CREATE POLICY "Community messages are viewable by everyone" ON public.community_messages FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_messages' AND policyname = 'Users can insert own messages') THEN
        CREATE POLICY "Users can insert own messages" ON public.community_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';