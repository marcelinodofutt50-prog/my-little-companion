-- 1) migration_waves: esconder a chave administrativa dos clientes
REVOKE SELECT ON public.migration_waves FROM authenticated;
GRANT SELECT (id, panel, title, instructions, server_label, opened_at, deadline_at, closed_at,
              is_active, created_by, created_at, updated_at, is_test, has_deadline, test_base_url)
  ON public.migration_waves TO authenticated;
GRANT ALL ON public.migration_waves TO service_role;

-- 2) Bucket tutorials: apenas equipe escreve
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
DROP POLICY IF EXISTS "Staff Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow staff to update tutorials" ON storage.objects;
CREATE POLICY "Staff can update tutorials" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'tutorials' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'tutorials' AND public.is_staff(auth.uid()));

-- 3) Buckets de anúncios: envio somente pela equipe
DROP POLICY IF EXISTS "Admins can upload announcement files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload announcement images" ON storage.objects;
CREATE POLICY "Staff can upload announcement files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'announcement-files' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff can upload announcement images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'announcement-images' AND public.is_staff(auth.uid()));