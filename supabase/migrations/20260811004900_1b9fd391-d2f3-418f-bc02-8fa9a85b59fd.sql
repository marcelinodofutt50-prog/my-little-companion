-- 1. Extend app_role if not already present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'app_role' AND n.nspname = 'public') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'support', 'user');
    ELSE
        -- Add support if missing
        BEGIN
            ALTER TYPE public.app_role ADD VALUE 'support';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- 2. Extend vip_tier enum
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'vip_tier' AND n.nspname = 'public') THEN
        BEGIN ALTER TYPE public.vip_tier ADD VALUE 'bronze'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE public.vip_tier ADD VALUE 'silver'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE public.vip_tier ADD VALUE 'diamond'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    ELSE
        CREATE TYPE public.vip_tier AS ENUM ('none', 'vip', 'bronze', 'silver', 'gold', 'diamond', 'elite');
    END IF;
END $$;

-- 3. Ensure profiles has the new columns if missing
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS reward_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_points_earned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS trial_7d_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_7d_expires_at TIMESTAMPTZ;

-- 4. Create staff_messages if not exists
CREATE TABLE IF NOT EXISTS public.staff_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    channel TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT ON public.staff_messages TO authenticated;
GRANT ALL ON public.staff_messages TO service_role;

ALTER TABLE public.staff_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Staff can read messages' AND polrelid = 'public.staff_messages'::regclass) THEN
        CREATE POLICY "Staff can read messages" ON public.staff_messages
        FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'support'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Staff can send messages' AND polrelid = 'public.staff_messages'::regclass) THEN
        CREATE POLICY "Staff can send messages" ON public.staff_messages
        FOR INSERT TO authenticated
        WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'support'));
    END IF;
END $$;

-- Force schema reload
SELECT pg_notify('pgrst', 'reload schema');
