CREATE TABLE public.refund_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES public.refund_requests(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  from_status text,
  to_status text,
  ai_verdict text,
  ai_confidence integer,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_refund_audit_log_refund_id ON public.refund_audit_log(refund_id, created_at DESC);

GRANT SELECT ON public.refund_audit_log TO authenticated;
GRANT ALL ON public.refund_audit_log TO service_role;

ALTER TABLE public.refund_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view refund audit log"
ON public.refund_audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));