DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.migration_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.migration_requests REPLICA IDENTITY FULL;