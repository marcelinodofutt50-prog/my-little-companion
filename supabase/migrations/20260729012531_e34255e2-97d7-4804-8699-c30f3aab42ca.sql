ALTER PUBLICATION supabase_realtime ADD TABLE public.support_threads;
ALTER TABLE public.support_threads REPLICA IDENTITY FULL;
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;