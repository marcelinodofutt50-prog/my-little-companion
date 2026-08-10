GRANT SELECT, INSERT, UPDATE ON TABLE public.support_threads TO authenticated;
GRANT SELECT, INSERT ON TABLE public.support_messages TO authenticated;
GRANT ALL ON TABLE public.support_threads TO service_role;
GRANT ALL ON TABLE public.support_messages TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

WITH ranked_open_threads AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS position
  FROM public.support_threads
  WHERE status <> 'closed'
)
UPDATE public.support_threads AS thread
SET status = 'closed',
    closed_at = COALESCE(thread.closed_at, now()),
    closed_by_name = COALESCE(thread.closed_by_name, 'Sistema — ticket duplicado consolidado')
FROM ranked_open_threads AS ranked
WHERE thread.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS support_threads_one_active_per_user_idx
ON public.support_threads (user_id)
WHERE status <> 'closed';