-- Run only against the confirmed production project: dvnksmqbpbzwgwmbnjjy
-- Restores the Play Protect 7-day grant system (kept fully separate from the
-- ShadowDash 24h trial and from the Yaarsa technical trial).

CREATE TABLE IF NOT EXISTS public.play_protect_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  license_id uuid UNIQUE,
  source text NOT NULL DEFAULT 'license_purchase',
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.play_protect_grants TO authenticated;
GRANT ALL ON public.play_protect_grants TO service_role;

ALTER TABLE public.play_protect_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own play protect grants" ON public.play_protect_grants;
CREATE POLICY "Users can view their own play protect grants"
  ON public.play_protect_grants FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_play_protect_eligible_slug(_slug text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _slug IN (
    'monthly_457','lifetime_46','kraken-monthly','kraken-lifetime',
    'upgrade_v46','upgrade-457-to-46'
  );
$$;

CREATE OR REPLACE FUNCTION public.grant_play_protect_7d_for_license()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

NOTIFY pgrst, 'reload schema';
