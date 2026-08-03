-- 1. Garante que RLS está habilitado e existem políticas de escrita
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_threads' AND policyname = 'Users can create own threads') THEN
        CREATE POLICY "Users can create own threads" ON public.support_threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_threads' AND policyname = 'Users can view own threads') THEN
        CREATE POLICY "Users can view own threads" ON public.support_threads FOR SELECT TO authenticated USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_messages' AND policyname = 'Users can send messages to own threads') THEN
        CREATE POLICY "Users can send messages to own threads" ON public.support_messages FOR INSERT TO authenticated WITH CHECK (
            EXISTS (SELECT 1 FROM public.support_threads WHERE id = thread_id AND user_id = auth.uid())
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_messages' AND policyname = 'Users can view messages in own threads') THEN
        CREATE POLICY "Users can view messages in own threads" ON public.support_messages FOR SELECT TO authenticated USING (
            EXISTS (SELECT 1 FROM public.support_threads WHERE id = thread_id AND user_id = auth.uid())
        );
    END IF;
END $$;

-- 2. Garante permissões de escrita para usuários autenticados
GRANT SELECT, INSERT, UPDATE ON public.support_threads TO authenticated;
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_threads TO service_role;
GRANT ALL ON public.support_messages TO service_role;

-- 3. Limpa cache do PostgREST
NOTIFY pgrst, 'reload schema';