-- Shadow Infrastructure v8.1: Tactical Schema Enforcement
DO $$ 
BEGIN
    -- profiles.metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'metadata') THEN
        ALTER TABLE public.profiles ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
    END IF;

    -- profiles.vip_tier
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'vip_tier') THEN
        ALTER TABLE public.profiles ADD COLUMN vip_tier text DEFAULT 'none';
    END IF;

    -- community_messages
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'community_messages') THEN
        CREATE TABLE public.community_messages (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            content text NOT NULL,
            created_at timestamptz DEFAULT now()
        );
        
        GRANT SELECT, INSERT ON public.community_messages TO authenticated;
        GRANT ALL ON public.community_messages TO service_role;
        
        ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Anyone authenticated can read community messages" 
            ON public.community_messages FOR SELECT TO authenticated USING (true);
            
        CREATE POLICY "Users can insert their own messages" 
            ON public.community_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    END IF;

    -- user_loyalty (missions fallback)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_loyalty') THEN
        CREATE TABLE public.user_loyalty (
            user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            points integer DEFAULT 0,
            current_tier text DEFAULT 'starter',
            days_active integer DEFAULT 0,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        GRANT SELECT, UPDATE ON public.user_loyalty TO authenticated;
        GRANT ALL ON public.user_loyalty TO service_role;
        ALTER TABLE public.user_loyalty ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can read own loyalty" ON public.user_loyalty FOR SELECT TO authenticated USING (auth.uid() = user_id);
    END IF;
END $$;

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
SELECT public.force_refresh_schema_permissions();
