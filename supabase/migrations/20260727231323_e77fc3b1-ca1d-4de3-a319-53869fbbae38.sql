CREATE TABLE public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  order_id uuid,
  license_id uuid,
  amount numeric not null default 0,
  reason text not null,
  pix_key text,
  status text not null default 'requested',
  admin_notes text,
  processed_by uuid,
  processed_at timestamptz,
  deadline_at timestamptz not null default (now() + interval '2 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refunds_select_own" ON public.refund_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "refunds_insert_own" ON public.refund_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'requested');

CREATE POLICY "refunds_admin_update" ON public.refund_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER refund_requests_updated_at BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_refund_requests_user ON public.refund_requests(user_id);
CREATE INDEX idx_refund_requests_status ON public.refund_requests(status);