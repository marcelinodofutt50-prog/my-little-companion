
-- moderator role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';

-- Referrals
CREATE OR REPLACE FUNCTION public.gen_referral_code()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code TEXT; i INT;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code);
  END LOOP;
  RETURN code;
END; $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referral_reward_pref TEXT NOT NULL DEFAULT 'cashback' CHECK (referral_reward_pref IN ('cashback','free_month','pix')),
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS legacy_status text NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS legacy_panel_hits jsonb,
  ADD COLUMN IF NOT EXISTS legacy_checked_at timestamptz;

UPDATE public.profiles SET referral_code = public.gen_referral_code() WHERE referral_code IS NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb;
CREATE INDEX IF NOT EXISTS orders_referrer_id_idx ON public.orders(referrer_id);

CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('cashback','free_month','pix')),
  reward_amount NUMERIC(10,2) NOT NULL DEFAULT 150.00,
  reward_status TEXT NOT NULL DEFAULT 'pending' CHECK (reward_status IN ('pending','granted','paid')),
  pix_key TEXT,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (referred_id)
);
CREATE INDEX referrals_referrer_idx ON public.referrals(referrer_id, created_at DESC);
CREATE INDEX referrals_status_idx ON public.referrals(reward_status, created_at DESC);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own referrals read" ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update referrals" ON public.referrals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER referrals_updated_at BEFORE UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN NEW.referral_code := public.gen_referral_code(); END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_set_referral_code BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_referral_code();

-- Panel column + upgrade plan + upgraded_from
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS panel text NOT NULL DEFAULT 'v457' CHECK (panel IN ('v457','v46')),
  ADD COLUMN IF NOT EXISTS upgraded_from_license_id uuid REFERENCES public.licenses(id),
  ADD COLUMN IF NOT EXISTS paid_externally boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_externally_until date,
  ADD COLUMN IF NOT EXISTS paid_externally_marked_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_externally_last_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_externally_last_check_status text;

CREATE INDEX licenses_panel_idx ON public.licenses(panel);
CREATE INDEX licenses_paid_externally_idx ON public.licenses (paid_externally, paid_externally_until) WHERE paid_externally = true;

INSERT INTO public.plans (slug, name, price_brl, category, active, description)
VALUES ('upgrade-457-to-46','Upgrade v4.5.7 → v4.6', 600,'upgrade', true,'Migra licença antiga v4.5.7 para v4.6.')
ON CONFLICT (slug) DO NOTHING;

-- Payout requests
CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('pix','cashback')),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  pix_key text, user_notes text, admin_notes text, receipt_reference text,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','paid','confirmed','rejected')),
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at timestamptz, confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payout_requests_user_idx ON public.payout_requests(user_id, created_at DESC);
CREATE INDEX payout_requests_status_idx ON public.payout_requests(status, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own payouts read" ON public.payout_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Own payouts insert" ON public.payout_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'requested');
CREATE POLICY "Own payouts confirm receipt" ON public.payout_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status = 'paid') WITH CHECK (auth.uid() = user_id AND status = 'confirmed');
CREATE POLICY "Admins update payouts" ON public.payout_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER payout_requests_updated_at BEFORE UPDATE ON public.payout_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- APK jobs
CREATE TYPE public.apk_job_status AS ENUM ('queued','claimed','sending','processing','done','failed','expired','cancelled');
CREATE TABLE public.apk_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.apk_job_status NOT NULL DEFAULT 'queued',
  source_path text NOT NULL, source_filename text NOT NULL, source_size_bytes bigint NOT NULL,
  result_path text, result_filename text, result_size_bytes bigint,
  is_free_trial boolean NOT NULL DEFAULT false,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  error_message text, worker_id text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz, started_at timestamptz, completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_apk_jobs_user ON public.apk_jobs(user_id, created_at DESC);
CREATE INDEX idx_apk_jobs_queue ON public.apk_jobs(status, queued_at) WHERE status IN ('queued','claimed','sending','processing');
GRANT SELECT, INSERT, UPDATE ON public.apk_jobs TO authenticated;
GRANT ALL ON public.apk_jobs TO service_role;
ALTER TABLE public.apk_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own apk jobs" ON public.apk_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own apk jobs" ON public.apk_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users cancel own queued" ON public.apk_jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status = 'queued') WITH CHECK (auth.uid() = user_id AND status IN ('queued','cancelled'));
CREATE POLICY "admins manage apk jobs" ON public.apk_jobs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_apk_jobs_updated BEFORE UPDATE ON public.apk_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
ALTER PUBLICATION supabase_realtime ADD TABLE public.apk_jobs;

INSERT INTO public.plans (slug, name, description, price_brl, days, category, active, sort_order)
VALUES ('play-protect-monthly','Play Protect — Mensal','Bypass Play Protect ilimitado por 30 dias.',450,30,'addon',true,90)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_active_play_protect(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.licenses l
    WHERE l.user_id = _user_id
      AND (auth.uid() = _user_id OR public.has_role(auth.uid(), 'admin'))
      AND l.plan_slug = 'play-protect-monthly'
      AND l.disabled_at IS NULL AND l.revoked = false
      AND (l.expires_at IS NULL OR l.expires_at > now()));
$$;
REVOKE ALL ON FUNCTION public.has_active_play_protect(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_play_protect(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.expire_stale_apk_jobs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.apk_jobs SET status = 'expired'
   WHERE status IN ('queued','claimed','sending','processing') AND expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.expire_stale_apk_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_apk_jobs() TO service_role;

-- realtime
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Crypto payments
CREATE TABLE public.crypto_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  plan_slug text NOT NULL,
  network text NOT NULL CHECK (network IN ('bitcoin','ethereum','tron','bsc')),
  coin text NOT NULL,
  tx_hash text NOT NULL,
  expected_address text NOT NULL,
  proof_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verifying','confirmed','fulfilled','failed','rejected')),
  confirmations integer NOT NULL DEFAULT 0,
  required_confirmations integer NOT NULL DEFAULT 6,
  amount_brl numeric,
  amount_crypto numeric, amount_brl_verified numeric, fx_rate_brl numeric,
  last_checked_at timestamptz, verified_at timestamptz, fulfilled_at timestamptz,
  failure_reason text, admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX crypto_payments_tx_unique ON public.crypto_payments (network, lower(tx_hash));
CREATE INDEX crypto_payments_user_idx ON public.crypto_payments (user_id, created_at DESC);
CREATE INDEX crypto_payments_status_idx ON public.crypto_payments (status) WHERE status IN ('pending','verifying');
GRANT SELECT, INSERT ON public.crypto_payments TO authenticated;
GRANT ALL ON public.crypto_payments TO service_role;
ALTER TABLE public.crypto_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crypto_payments read own or admin" ON public.crypto_payments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "crypto_payments insert own" ON public.crypto_payments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "crypto_payments admin update" ON public.crypto_payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Plans admin + image_url
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS image_url text;
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT INSERT, UPDATE, DELETE ON public.plans TO authenticated;

-- Updates table
CREATE TABLE public.updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL, version TEXT NOT NULL, notes TEXT,
  min_tier TEXT NOT NULL DEFAULT 'weekly' CHECK (min_tier IN ('weekly','monthly_457','lifetime_46')),
  storage_path TEXT NOT NULL, filename TEXT NOT NULL, size_bytes BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.updates TO authenticated;
GRANT ALL ON public.updates TO service_role;
ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read active updates" ON public.updates FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage updates" ON public.updates FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_updates_updated_at BEFORE UPDATE ON public.updates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX idx_updates_active_tier ON public.updates(is_active, min_tier, created_at DESC);

-- Storage policies for apk, crypto-proofs, market-images, updates buckets
CREATE POLICY "users read own apk-uploads" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'apk-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users upload own apk-uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'apk-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users read own apk-results" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'apk-results' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "crypto proofs upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'crypto-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "crypto proofs read own or admin" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'crypto-proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Market images admin write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'market-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Market images admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'market-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Market images admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'market-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Market images authenticated read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'market-images');
CREATE POLICY "Admins upload updates" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'updates' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage update files" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'updates' AND public.has_role(auth.uid(),'admin')) WITH CHECK (bucket_id = 'updates' AND public.has_role(auth.uid(),'admin'));

-- Skip revocation for externally-paid licenses so the day-20 cron never touches them.
DROP FUNCTION IF EXISTS public.revoke_unpaid_server_licenses();
CREATE OR REPLACE FUNCTION public.revoke_unpaid_server_licenses()
 RETURNS TABLE(id uuid, user_id uuid, yaarsa_email text, panel text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE public.licenses l
     SET revoked = true, server_overdue_at = now()
   WHERE l.revoked = false AND l.disabled_at IS NULL AND l.is_trial = false
     AND l.paid_externally = false
     AND l.server_paid_until IS NOT NULL
     AND l.server_paid_until < (now() AT TIME ZONE 'America/Sao_Paulo')::date
  RETURNING l.id, l.user_id, l.yaarsa_email, l.panel::text;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.revoke_unpaid_server_licenses() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_unpaid_server_licenses() TO service_role;
