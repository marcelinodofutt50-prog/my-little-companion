UPDATE public.trials t
SET ip_hash = s.ip_hash
FROM (
  SELECT DISTINCT ON (user_id) user_id, ip_hash
  FROM public.signup_ip_log
  WHERE user_id IS NOT NULL
  ORDER BY user_id, created_at ASC
) s
WHERE s.user_id = t.user_id AND t.ip_hash IS NULL;