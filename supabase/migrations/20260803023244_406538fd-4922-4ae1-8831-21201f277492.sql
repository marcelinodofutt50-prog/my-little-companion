-- 1. Ensure RLS is enabled and policies exist for all critical tables
ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- 2. Add missing RLS policy for inserting trials if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can claim own trial') THEN
        CREATE POLICY "Users can claim own trial" ON public.trials FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 3. Double-check and re-apply GRANTS to be absolutely sure PostgREST can see columns
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trials TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_threads TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated, service_role;

-- 4. Reload schema cache again
NOTIFY pgrst, 'reload schema';

-- 5. Verification: Check column existence for 'trials' one last time
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'trials' AND table_schema = 'public';