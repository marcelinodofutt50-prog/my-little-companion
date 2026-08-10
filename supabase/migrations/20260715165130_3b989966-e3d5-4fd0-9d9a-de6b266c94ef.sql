
CREATE POLICY "support-media own read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'support-media' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "support-media own insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'support-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "support-media admin all" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'support-media' AND public.has_role(auth.uid(),'admin'))
WITH CHECK (bucket_id = 'support-media' AND public.has_role(auth.uid(),'admin'));
