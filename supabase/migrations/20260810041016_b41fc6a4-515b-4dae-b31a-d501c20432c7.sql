-- Refresh schema permissions to fix PGRST108 cache errors
SELECT force_refresh_schema_permissions();

-- Fix potential permission gaps for the community system
GRANT SELECT, INSERT ON public.community_messages TO authenticated;
GRANT SELECT ON public.community_goals TO authenticated;

-- Ensure authenticated users have proper access to profiles for UI metadata
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- Hard repair for RLS on community_messages if missing
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_messages' AND policyname = 'Anyone can view messages') THEN
        CREATE POLICY "Anyone can view messages" ON public.community_messages FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_messages' AND policyname = 'Authenticated users can send messages') THEN
        CREATE POLICY "Authenticated users can send messages" ON public.community_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
