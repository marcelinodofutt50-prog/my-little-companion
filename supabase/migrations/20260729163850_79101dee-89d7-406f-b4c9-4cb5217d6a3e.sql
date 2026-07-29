CREATE TABLE public.email_confirm_retries (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  done boolean NOT NULL DEFAULT false,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.email_confirm_retries TO service_role;
GRANT SELECT ON public.email_confirm_retries TO authenticated;

ALTER TABLE public.email_confirm_retries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view confirm retries"
  ON public.email_confirm_retries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_email_confirm_retries_updated_at
BEFORE UPDATE ON public.email_confirm_retries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();