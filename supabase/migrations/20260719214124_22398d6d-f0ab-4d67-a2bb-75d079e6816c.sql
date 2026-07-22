
-- ============ updates table ============
CREATE TABLE public.updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  version TEXT NOT NULL,
  notes TEXT,
  min_tier TEXT NOT NULL DEFAULT 'weekly' CHECK (min_tier IN ('weekly','monthly_457','lifetime_46')),
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  size_bytes BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.updates TO authenticated;
GRANT ALL ON public.updates TO service_role;

ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read active updates"
  ON public.updates FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage updates"
  ON public.updates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_updates_updated_at
  BEFORE UPDATE ON public.updates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_updates_active_tier ON public.updates(is_active, min_tier, created_at DESC);

-- ============ storage policies for 'updates' bucket ============
CREATE POLICY "Admins upload updates"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'updates' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage update files"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'updates' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'updates' AND public.has_role(auth.uid(), 'admin'));
