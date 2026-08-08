-- Storage RLS policies for tutorials bucket
create policy "Allow staff to upload tutorials"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'tutorials' AND
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

create policy "Allow public to read tutorials"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'tutorials');

create policy "Allow staff to update tutorials"
on storage.objects for update
to authenticated
using (bucket_id = 'tutorials')
with check (
  bucket_id = 'tutorials' AND
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

create policy "Allow staff to delete tutorials"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'tutorials' AND
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);
