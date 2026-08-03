-- Revoke existing to be sure
DROP POLICY IF EXISTS "Anyone can view announcement images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view announcement files" ON storage.objects;

-- Re-add
CREATE POLICY "Anyone can view announcement images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'announcement-images');
CREATE POLICY "Anyone can view announcement files" ON storage.objects FOR SELECT TO public USING (bucket_id = 'announcement-files');
