CREATE TABLE public.partner_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  name text NOT NULL,
  contact text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_customers_partner_idx ON public.partner_customers(partner_id, created_at DESC);

CREATE TABLE public.partner_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  customer_id uuid REFERENCES public.partner_customers(id) ON DELETE SET NULL,
  plan_slug text NOT NULL DEFAULT 'login-30d',
  panel text NOT NULL DEFAULT 'v457',
  panel_username text,
  panel_email text,
  panel_password_enc text,
  status text NOT NULL DEFAULT 'pending_sync',
  expires_at timestamptz,
  price_cents integer NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_licenses_partner_idx ON public.partner_licenses(partner_id, created_at DESC);
CREATE INDEX partner_licenses_customer_idx ON public.partner_licenses(customer_id);

CREATE TABLE public.partner_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  license_id uuid REFERENCES public.partner_licenses(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.partner_customers(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'pix',
  note text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_payments_partner_idx ON public.partner_payments(partner_id, paid_at DESC);

GRANT SELECT ON public.partner_customers TO authenticated;
GRANT SELECT ON public.partner_licenses TO authenticated;
GRANT SELECT ON public.partner_payments TO authenticated;
GRANT ALL ON public.partner_customers TO service_role;
GRANT ALL ON public.partner_licenses TO service_role;
GRANT ALL ON public.partner_payments TO service_role;

ALTER TABLE public.partner_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner reads own customers" ON public.partner_customers
  FOR SELECT TO authenticated
  USING (auth.uid() = partner_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "partner reads own licenses" ON public.partner_licenses
  FOR SELECT TO authenticated
  USING (auth.uid() = partner_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "partner reads own payments" ON public.partner_payments
  FOR SELECT TO authenticated
  USING (auth.uid() = partner_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_partner_customers_updated BEFORE UPDATE ON public.partner_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_partner_licenses_updated BEFORE UPDATE ON public.partner_licenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
