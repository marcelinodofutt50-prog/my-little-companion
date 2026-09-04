ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_role text,
  ADD COLUMN IF NOT EXISTS sender_avatar_url text;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  PERFORM public.notify_pgrst_reload();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;