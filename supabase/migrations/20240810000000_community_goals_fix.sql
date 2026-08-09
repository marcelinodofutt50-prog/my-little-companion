-- Create community_goals table if it doesn't exist (ensuring it matches the frontend's expectations)
CREATE TABLE IF NOT EXISTS public.community_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_members INTEGER NOT NULL UNIQUE,
    reward_description TEXT NOT NULL,
    benefit_description TEXT,
    achieved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Grant permissions
GRANT SELECT ON public.community_goals TO authenticated;
GRANT ALL ON public.community_goals TO service_role;

-- Enable RLS
ALTER TABLE public.community_goals ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'community_goals' AND policyname = 'Authenticated users can read goals'
    ) THEN
        CREATE POLICY "Authenticated users can read goals" ON public.community_goals
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- Seed initial goals if table is empty
INSERT INTO public.community_goals (target_members, reward_description, benefit_description)
SELECT 2500, 'Beta Access: Shadow Nexus 2.0', 'Reduced latency for all nodes'
WHERE NOT EXISTS (SELECT 1 FROM public.community_goals WHERE target_members = 2500);

INSERT INTO public.community_goals (target_members, reward_description, benefit_description)
SELECT 5000, 'Global License Giveaway', 'Permanent VIP status for top 50 operators'
WHERE NOT EXISTS (SELECT 1 FROM public.community_goals WHERE target_members = 5000);

INSERT INTO public.community_goals (target_members, reward_description, benefit_description)
SELECT 10000, 'Shadow Satellite Network', 'Direct satellite uplink bypass'
WHERE NOT EXISTS (SELECT 1 FROM public.community_goals WHERE target_members = 10000);

-- Ensure profiles has required columns for community metrics
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS conversions_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referrals_valid_count INTEGER DEFAULT 0;
