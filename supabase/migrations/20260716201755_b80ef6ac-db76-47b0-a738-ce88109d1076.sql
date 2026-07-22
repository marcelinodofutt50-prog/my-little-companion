CREATE TABLE public.integration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL,
  action TEXT,
  endpoint_kind TEXT,
  url TEXT,
  attempt INT,
  http_status INT,
  latency_ms INT,
  outcome TEXT,
  payload JSONB,
  response_body TEXT,
  error TEXT,
  context JSONB
);
GRANT SELECT ON public.integration_logs TO authenticated;
GRANT ALL ON public.integration_logs TO service_role;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read integration logs" ON public.integration_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX integration_logs_created_at_idx ON public.integration_logs (created_at DESC);
CREATE INDEX integration_logs_source_idx ON public.integration_logs (source, created_at DESC);