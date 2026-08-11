-- 1. Profiles: Trial Infrastructure
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 2. Community: Nexus Infrastructure
CREATE TABLE IF NOT EXISTS public.community_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_anonymous boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 3. Training: Progress Infrastructure
CREATE TABLE IF NOT EXISTS public.tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  video_url text,
  thumbnail_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tutorial_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tutorial_id uuid REFERENCES public.tutorials(id) ON DELETE CASCADE,
  completed boolean DEFAULT false,
  last_watched_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tutorial_id)
);

-- 4. Permissions
GRANT SELECT, INSERT ON public.community_messages TO authenticated;
GRANT SELECT ON public.tutorials TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tutorial_progress TO authenticated;
GRANT ALL ON public.community_messages, public.tutorials, public.tutorial_progress TO service_role;

-- 5. RLS
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorial_progress ENABLE ROW LEVEL SECURITY;

-- 6. Reload
NOTIFY pgrst, 'reload schema';
