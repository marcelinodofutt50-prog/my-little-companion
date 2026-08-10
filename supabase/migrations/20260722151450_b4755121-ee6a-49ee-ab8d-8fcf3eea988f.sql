
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============ PLANS ============
CREATE TABLE public.plans (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_brl NUMERIC(10,2) NOT NULL,
  days INTEGER,
  category TEXT NOT NULL DEFAULT 'license',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans readable" ON public.plans FOR SELECT TO anon, authenticated USING (active = true);

INSERT INTO public.plans (slug, name, description, price_brl, days, category, sort_order) VALUES
  ('login-7d','Login 7 dias','Acesso a ferramenta BTMOB por 7 dias', 450.00, 7, 'license', 1),
  ('login-30d','Login 30 dias','Acesso a ferramenta BTMOB por 30 dias', 750.00, 30, 'license', 2),
  ('login-lifetime','Login Vitalicio','Acesso vitalicio a ferramenta BTMOB', 1700.00, NULL, 'license', 3),
  ('server-monthly','Renovacao Servidor','Renovacao mensal do servidor (vence todo dia 20)', 450.00, 30, 'server', 4),
  ('source-yaarsa','Codigo-fonte Yaarsa','Codigo-fonte completo do painel Yaarsa', 2700.00, NULL, 'source', 5),
  ('source-full','Codigo-fonte BTMOB + Servidor','Codigo-fonte completo do BTMOB + servidor', 4600.00, NULL, 'source', 6);

-- ============ COUPONS ============
CREATE TABLE public.coupons (
  code TEXT PRIMARY KEY,
  discount_pct INTEGER NOT NULL DEFAULT 0,
  cashback_pct INTEGER NOT NULL DEFAULT 40,
  first_deposit_only BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  uses_left INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO anon, authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coupons admin" ON public.coupons FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.coupons (code, discount_pct, cashback_pct) VALUES ('SHADOW40', 0, 40), ('KREMLIN', 0, 40);

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_slug TEXT NOT NULL REFERENCES public.plans(slug),
  amount NUMERIC(10,2) NOT NULL,
  coupon_code TEXT,
  cashback_used NUMERIC(10,2) DEFAULT 0,
  cashback_credited NUMERIC(10,2) DEFAULT 0,
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own orders read" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Own orders insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'
  AND (cashback_credited IS NULL OR cashback_credited = 0)
  AND mp_payment_id IS NULL
  AND paid_at IS NULL
);

-- ============ LICENSES ============
CREATE TABLE public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id),
  plan_slug TEXT NOT NULL,
  yaarsa_username TEXT NOT NULL,
  yaarsa_email TEXT NOT NULL,
  yaarsa_password_enc TEXT NOT NULL,
  server_ip TEXT NOT NULL DEFAULT '191.96.78.81',
  expires_at TIMESTAMPTZ,
  server_paid_until DATE,
  revoked BOOLEAN NOT NULL DEFAULT false,
  is_trial BOOLEAN NOT NULL DEFAULT false,
  suspended_at timestamptz,
  suspended_by text,
  expires_at_before_suspend timestamptz,
  disabled_at timestamptz,
  version_tier text,
  is_legacy boolean NOT NULL DEFAULT false,
  legacy_server_fee_brl numeric,
  server_overdue_at timestamptz,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own licenses read" ON public.licenses FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- ============ TRIALS ============
CREATE TABLE public.trials (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  license_id UUID REFERENCES public.licenses(id)
);
GRANT SELECT ON public.trials TO authenticated;
GRANT ALL ON public.trials TO service_role;
ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own trial read" ON public.trials FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- ============ CASHBACK ============
CREATE TABLE public.cashback_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cashback_ledger TO authenticated;
GRANT ALL ON public.cashback_ledger TO service_role;
ALTER TABLE public.cashback_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own cashback read" ON public.cashback_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- ============ SUPPORT ============
CREATE TABLE public.support_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT 'Suporte',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_threads TO authenticated;
GRANT ALL ON public.support_threads TO service_role;
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own thread read" ON public.support_threads FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Own thread insert" ON public.support_threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own thread update" ON public.support_threads FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  body TEXT,
  attachment_url TEXT,
  attachment_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Thread msgs read" ON public.support_messages FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR
  EXISTS(SELECT 1 FROM public.support_threads t WHERE t.id = thread_id AND t.user_id = auth.uid())
);
CREATE POLICY "Thread msgs insert" ON public.support_messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND (
    public.has_role(auth.uid(),'admin') OR
    EXISTS(SELECT 1 FROM public.support_threads t WHERE t.id = thread_id AND t.user_id = auth.uid())
  )
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.licenses;

-- ============ WEBHOOK LOGS ============
CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  payload JSONB,
  processed BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.webhook_logs TO authenticated;
GRANT ALL ON public.webhook_logs TO service_role;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin webhook logs" ON public.webhook_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============ INTEGRATION LOGS ============
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
CREATE POLICY "Admins can read integration logs" ON public.integration_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX integration_logs_created_at_idx ON public.integration_logs (created_at DESC);
CREATE INDEX integration_logs_source_idx ON public.integration_logs (source, created_at DESC);

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_licenses_updated BEFORE UPDATE ON public.licenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_threads_updated BEFORE UPDATE ON public.support_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto profile + admin seeding
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  IF NEW.email = 'callioniskate@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE POLICY "support-media own read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'support-media' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "support-media own insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'support-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "support-media admin all" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'support-media' AND public.has_role(auth.uid(),'admin'))
WITH CHECK (bucket_id = 'support-media' AND public.has_role(auth.uid(),'admin'));

INSERT INTO public.coupons (code, discount_pct, cashback_pct, active) VALUES ('BTMOB40', 0, 40, true) ON CONFLICT (code) DO UPDATE SET cashback_pct = EXCLUDED.cashback_pct, active = true;

CREATE OR REPLACE FUNCTION public.enforce_support_msg_admin_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    NEW.is_admin := COALESCE(NEW.is_admin, false);
  ELSE
    NEW.is_admin := false;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_support_msg_admin_flag ON public.support_messages;
CREATE TRIGGER trg_enforce_support_msg_admin_flag
BEFORE INSERT OR UPDATE ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_support_msg_admin_flag();

REVOKE EXECUTE ON FUNCTION public.enforce_support_msg_admin_flag() FROM PUBLIC, anon, authenticated;

-- Track when a license was auto-revoked for unpaid server renewal.
CREATE OR REPLACE FUNCTION public.revoke_unpaid_server_licenses()
RETURNS TABLE(id uuid, user_id uuid, yaarsa_email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.licenses l
     SET revoked = true, server_overdue_at = now()
   WHERE l.revoked = false
     AND l.disabled_at IS NULL
     AND l.is_trial = false
     AND l.server_paid_until IS NOT NULL
     AND l.server_paid_until < (now() AT TIME ZONE 'America/Sao_Paulo')::date
  RETURNING l.id, l.user_id, l.yaarsa_email;
END; $$;

REVOKE ALL ON FUNCTION public.revoke_unpaid_server_licenses() FROM PUBLIC;
