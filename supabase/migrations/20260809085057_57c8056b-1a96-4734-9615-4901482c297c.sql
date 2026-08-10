-- SHADOWDASH SECURITY HARDENING V6.5
-- Applied to fix search_path vulnerabilities in legacy SECURITY DEFINER functions

-- 1. has_role fix
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- 2. handle_new_user fix
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (new.id, split_part(new.email, '@', 1), new.email);
  RETURN new;
END;
$$;

-- 3. update_updated_at_column fix
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 4. check_rls_enabled fix
CREATE OR REPLACE FUNCTION public.check_rls_enabled(target_table text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_enabled boolean;
BEGIN
  SELECT relrowsecurity INTO is_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = target_table;
  
  RETURN COALESCE(is_enabled, false);
END;
$$;

-- 5. calculate_license_status fix (with drop first as requested by hint)
DROP FUNCTION IF EXISTS public.calculate_license_status(uuid);
CREATE OR REPLACE FUNCTION public.calculate_license_status(lic_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires timestamptz;
  v_suspended timestamptz;
BEGIN
  SELECT expires_at, suspended_at INTO v_expires, v_suspended
  FROM public.licenses WHERE id = lic_id;
  
  IF v_suspended IS NOT NULL THEN RETURN 'paused'; END IF;
  IF v_expires IS NULL THEN RETURN 'active'; END IF;
  IF v_expires < now() THEN RETURN 'expired'; END IF;
  RETURN 'active';
END;
$$;

-- 6. check_referral_integrity fix
CREATE OR REPLACE FUNCTION public.check_referral_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referrer_id = NEW.referred_id THEN
    RAISE EXCEPTION 'User cannot refer themselves';
  END IF;
  RETURN NEW;
END;
$$;

-- 7. Grant missing executions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
