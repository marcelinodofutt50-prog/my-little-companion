
CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('pix','cashback')),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  pix_key text,
  user_notes text,
  admin_notes text,
  receipt_reference text,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','paid','confirmed','rejected')),
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payout_requests_user_idx ON public.payout_requests(user_id, created_at DESC);
CREATE INDEX payout_requests_status_idx ON public.payout_requests(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own payouts read" ON public.payout_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Own payouts insert" ON public.payout_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'requested');

-- Users may only flip their own 'paid' request to 'confirmed'; admins may update anything.
CREATE POLICY "Own payouts confirm receipt" ON public.payout_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'paid')
  WITH CHECK (auth.uid() = user_id AND status = 'confirmed');

CREATE POLICY "Admins update payouts" ON public.payout_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER payout_requests_updated_at BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
