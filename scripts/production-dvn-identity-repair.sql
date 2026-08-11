-- Run only against the confirmed production project: dvnksmqbpbzwgwmbnjjy
-- Idempotent repair for the two checks currently failing in production.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS vip_tier text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS reputation_score integer NOT NULL DEFAULT 100;

CREATE TABLE IF NOT EXISTS public.community_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  is_anonymous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.community_messages TO authenticated;
GRANT ALL ON public.community_messages TO service_role;

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view community messages" ON public.community_messages;
CREATE POLICY "Authenticated users can view community messages"
  ON public.community_messages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create their own community messages" ON public.community_messages;
CREATE POLICY "Users can create their own community messages"
  ON public.community_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own community messages" ON public.community_messages;
CREATE POLICY "Users can delete their own community messages"
  ON public.community_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';