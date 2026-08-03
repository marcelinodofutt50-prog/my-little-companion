-- Allow authenticated users to upload
CREATE POLICY "Admins can upload announcement images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'announcement-images');
CREATE POLICY "Admins can upload announcement files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'announcement-files');

-- Allow public to read
CREATE POLICY "Anyone can view announcement images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'announcement-images');
CREATE POLICY "Anyone can view announcement files" ON storage.objects FOR SELECT TO public USING (bucket_id = 'announcement-files');
