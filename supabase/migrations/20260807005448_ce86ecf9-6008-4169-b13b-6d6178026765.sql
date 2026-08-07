-- Reforço da função has_role para ser robusta e SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Reforço da função check_license_quota
CREATE OR REPLACE FUNCTION public.check_license_quota(_staff_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _daily_limit integer;
    _monthly_limit integer;
    _daily_count integer;
    _monthly_count integer;
    _is_admin boolean;
BEGIN
    -- Admins têm cota infinita. Usamos casting explícito para evitar erro de tipo enum se houver.
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _staff_id AND role = 'admin'::public.app_role
    ) INTO _is_admin;
    
    IF _is_admin THEN
        RETURN true;
    END IF;

    -- Pega limites do atendente (ou default se não existir)
    SELECT daily_limit, monthly_limit INTO _daily_limit, _monthly_limit
    FROM public.support_quotas
    WHERE user_id = _staff_id;

    IF NOT FOUND THEN
        _daily_limit := 5;
        _monthly_limit := 30;
    END IF;

    -- Conta gerações no dia
    SELECT count(*)::integer INTO _daily_count
    FROM public.license_generation_logs
    WHERE staff_id = _staff_id
      AND created_at >= date_trunc('day', now());

    IF _daily_count >= _daily_limit THEN
        RETURN false;
    END IF;

    -- Conta gerações no mês
    SELECT count(*)::integer INTO _monthly_count
    FROM public.license_generation_logs
    WHERE staff_id = _staff_id
      AND created_at >= date_trunc('month', now());

    IF _monthly_count >= _monthly_limit THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$;

-- Garantir permissões de execução
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_license_quota(uuid) TO authenticated;

-- Garantir que o cache de esquema seja atualizado
NOTIFY pgrst, 'reload schema';