-- 1. Grant tracking table
CREATE TABLE IF NOT EXISTS public.play_protect_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  license_id uuid NOT NULL UNIQUE REFERENCES public.licenses(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'license_purchase',
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppg_user_active ON public.play_protect_grants (user_id, expires_at DESC);

GRANT SELECT ON public.play_protect_grants TO authenticated;
GRANT ALL ON public.play_protect_grants TO service_role;

ALTER TABLE public.play_protect_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own play protect grants"
  ON public.play_protect_grants FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all grants"
  ON public.play_protect_grants FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Eligibility helper: monthly / lifetime license slugs (real paid licenses)
CREATE OR REPLACE FUNCTION public.is_play_protect_eligible_slug(_slug text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _slug IN (
    'monthly_457','lifetime_46','kraken-monthly','kraken-lifetime',
    'upgrade_v46','upgrade-457-to-46'
  );
$$;

-- 3. Auto-grant trigger — idempotent (UNIQUE license_id blocks double grants)
CREATE OR REPLACE FUNCTION public.grant_play_protect_7d_for_license()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_trial IS TRUE THEN RETURN NEW; END IF;
  IF NEW.revoked IS TRUE THEN RETURN NEW; END IF;
  IF NOT public.is_play_protect_eligible_slug(NEW.plan_slug) THEN RETURN NEW; END IF;

  INSERT INTO public.play_protect_grants (user_id, license_id, source, granted_at, expires_at)
  VALUES (NEW.user_id, NEW.id, 'license_purchase', now(), now() + interval '7 days')
  ON CONFLICT (license_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_pp_7d ON public.licenses;
CREATE TRIGGER trg_grant_pp_7d
  AFTER INSERT ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.grant_play_protect_7d_for_license();

-- 4. Backfill retroactively (using license created_at so historical windows keep their real expiry)
INSERT INTO public.play_protect_grants (user_id, license_id, source, granted_at, expires_at)
SELECT l.user_id, l.id, 'backfill', l.created_at, l.created_at + interval '7 days'
FROM public.licenses l
WHERE l.is_trial IS NOT TRUE
  AND l.revoked IS FALSE
  AND public.is_play_protect_eligible_slug(l.plan_slug)
ON CONFLICT (license_id) DO NOTHING;

-- 5. Extend has_active_play_protect: paid PP plan OR active 7d grant
CREATE OR REPLACE FUNCTION public.has_active_play_protect(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    auth.uid() = _user_id OR public.has_role(auth.uid(), 'admin')
  ) AND (
    EXISTS (
      SELECT 1 FROM public.licenses l
      WHERE l.user_id = _user_id
        AND l.plan_slug = 'play-protect-monthly'
        AND l.disabled_at IS NULL AND l.revoked = false
        AND (l.expires_at IS NULL OR l.expires_at > now())
    )
    OR EXISTS (
      SELECT 1 FROM public.play_protect_grants g
      WHERE g.user_id = _user_id AND g.expires_at > now()
    )
  );
$$;

NOTIFY pgrst, 'reload schema';
