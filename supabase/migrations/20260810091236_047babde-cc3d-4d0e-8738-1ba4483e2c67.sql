DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'metadata') THEN
        ALTER TABLE public.profiles ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'vip_tier') THEN
        ALTER TABLE public.profiles ADD COLUMN vip_tier text DEFAULT 'free';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'reputation_score') THEN
        ALTER TABLE public.profiles ADD COLUMN reputation_score integer DEFAULT 0;
    END IF;
END $$;

GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.profiles TO anon;

NOTIFY pgrst, 'reload schema';