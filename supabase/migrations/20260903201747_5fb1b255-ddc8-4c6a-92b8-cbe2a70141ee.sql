ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_role text,
  ADD COLUMN IF NOT EXISTS sender_avatar_url text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

CREATE OR REPLACE FUNCTION public.fill_support_message_sender_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
  v_full_name text;
  v_email text;
  v_avatar text;
  v_role text;
BEGIN
  IF NEW.is_admin IS TRUE AND NEW.sender_id IS NOT NULL THEN
    SELECT display_name, full_name, email, avatar_url
      INTO v_display_name, v_full_name, v_email, v_avatar
      FROM public.profiles
     WHERE id = NEW.sender_id;

    SELECT role INTO v_role
      FROM public.user_roles
     WHERE user_id = NEW.sender_id
     ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END
     LIMIT 1;

    NEW.sender_name := COALESCE(NEW.sender_name, v_display_name, v_full_name, split_part(v_email, '@', 1), 'Equipe Shadow');
    NEW.sender_role := COALESCE(NEW.sender_role, v_role, 'staff');
    NEW.sender_avatar_url := COALESCE(NEW.sender_avatar_url, v_avatar);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_message_sender_identity ON public.support_messages;
CREATE TRIGGER trg_support_message_sender_identity
  BEFORE INSERT OR UPDATE ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_support_message_sender_identity();