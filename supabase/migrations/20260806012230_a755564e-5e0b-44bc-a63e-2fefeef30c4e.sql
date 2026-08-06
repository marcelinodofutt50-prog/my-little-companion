-- Policy for admins to do everything in the tutorials bucket
CREATE POLICY "Admins can manage tutorials"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'tutorials' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'tutorials' AND public.has_role(auth.uid(), 'admin'));

-- Policy for all authenticated users to read from the tutorials bucket
CREATE POLICY "Authenticated users can read tutorials"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'tutorials');