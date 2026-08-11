-- Shadow Protocol v17.0: Infraestructure Repair & Reload
-- 1. Restaurar colunas ausentes em public.profiles
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'metadata') THEN
    ALTER TABLE public.profiles ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'vip_tier') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vip_tier') THEN
      CREATE TYPE public.vip_tier AS ENUM ('none', 'vip', 'gold', 'elite');
    END IF;
    ALTER TABLE public.profiles ADD COLUMN vip_tier public.vip_tier DEFAULT 'none';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'reputation_score') THEN
    ALTER TABLE public.profiles ADD COLUMN reputation_score INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'conversions_count') THEN
    ALTER TABLE public.profiles ADD COLUMN conversions_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'referrals_valid_count') THEN
    ALTER TABLE public.profiles ADD COLUMN referrals_valid_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- 2. Garantir existência de public.tutorials e public.tutorial_progress
CREATE TABLE IF NOT EXISTS public.tutorials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    image_url TEXT,
    category TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    youtube_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.tutorial_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tutorial_id UUID REFERENCES public.tutorials(id) ON DELETE CASCADE NOT NULL,
    completed BOOLEAN DEFAULT false,
    last_watched_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, tutorial_id)
);

-- 3. Shadow Protocol: Correção de Foreign Key tutorial_progress -> tutorials
-- O erro anterior mostrou tutorial_id como TEXT. Vamos converter para UUID se necessário.
DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'tutorial_progress' AND column_name = 'tutorial_id') = 'text' THEN
        -- Tenta converter se for possível
        ALTER TABLE public.tutorial_progress 
        ALTER COLUMN tutorial_id TYPE UUID USING tutorial_id::uuid;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tutorial_progress_tutorial_id_fkey') THEN
        ALTER TABLE public.tutorial_progress 
        ADD CONSTRAINT tutorial_progress_tutorial_id_fkey 
        FOREIGN KEY (tutorial_id) REFERENCES public.tutorials(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. RLS e GRANTs (Shadow Protocol v17.0)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.tutorials TO authenticated;
GRANT ALL ON public.tutorials TO service_role;
GRANT ALL ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.tutorial_progress TO service_role;

-- 5. Reload Schema Cache (PostgREST)
NOTIFY pgrst, 'reload schema';
