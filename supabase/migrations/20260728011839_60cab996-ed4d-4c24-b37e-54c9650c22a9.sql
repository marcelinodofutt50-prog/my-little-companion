CREATE TABLE public.migration_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  current_panel text NOT NULL,
  panel_version text,
  old_username text NOT NULL,
  clients_count integer NOT NULL DEFAULT 0,
  old_expires_on date,
  notes text,
  proof_paths text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.migration_requests TO authenticated;
GRANT ALL ON public.migration_requests TO service_role;

ALTER TABLE public.migration_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own migration requests"
  ON public.migration_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own migration requests"
  ON public.migration_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own pending migration requests"
  ON public.migration_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update migration requests"
  ON public.migration_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX migration_requests_user_idx ON public.migration_requests (user_id, created_at DESC);
CREATE INDEX migration_requests_status_idx ON public.migration_requests (status, created_at DESC);

CREATE TRIGGER migration_requests_updated_at
  BEFORE UPDATE ON public.migration_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Comprovantes: cada usuário só mexe na própria pasta (prefixo = user_id)
CREATE POLICY "Users upload own migration proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'migration-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own migration proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'migration-proofs'
         AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Users delete own migration proofs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'migration-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);