-- Suporte (moderator) passa a ter os mesmos acessos de atendimento que o admin
DROP POLICY IF EXISTS "support-media admin all" ON storage.objects;
CREATE POLICY "support-media staff all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'support-media' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'support-media' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "support-media own read" ON storage.objects;
CREATE POLICY "support-media own read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'support-media' AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.is_staff(auth.uid())));

-- Play Protect: suporte pode ler/gravar os APKs da fila
DROP POLICY IF EXISTS "users read own apk-uploads" ON storage.objects;
CREATE POLICY "users read own apk-uploads" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'apk-uploads' AND ((storage.foldername(name))[1] = (auth.uid())::text OR public.is_staff(auth.uid())));

DROP POLICY IF EXISTS "users read own apk-results" ON storage.objects;
CREATE POLICY "users read own apk-results" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'apk-results' AND ((storage.foldername(name))[1] = (auth.uid())::text OR public.is_staff(auth.uid())));

CREATE POLICY "staff write apk-results" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'apk-results' AND public.is_staff(auth.uid()));

-- Consolida as policies de threads para aceitar admin OU suporte
DROP POLICY IF EXISTS "Own thread read" ON public.support_threads;
CREATE POLICY "Own thread read" ON public.support_threads
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Own thread update" ON public.support_threads;
CREATE POLICY "Own thread update" ON public.support_threads
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- Suporte precisa enxergar os cargos para o painel liberar as abas corretas
DROP POLICY IF EXISTS "Admins read all roles" ON public.user_roles;
CREATE POLICY "Staff read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));