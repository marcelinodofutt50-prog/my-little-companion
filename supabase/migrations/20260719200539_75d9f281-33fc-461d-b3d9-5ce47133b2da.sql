
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS image_url text;

DROP POLICY IF EXISTS "Admins manage plans" ON public.plans;
CREATE POLICY "Admins manage plans" ON public.plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;

DROP POLICY IF EXISTS "Market images admin write" ON storage.objects;
CREATE POLICY "Market images admin write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'market-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Market images admin update" ON storage.objects;
CREATE POLICY "Market images admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'market-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Market images admin delete" ON storage.objects;
CREATE POLICY "Market images admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'market-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Market images authenticated read" ON storage.objects;
CREATE POLICY "Market images authenticated read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'market-images');
