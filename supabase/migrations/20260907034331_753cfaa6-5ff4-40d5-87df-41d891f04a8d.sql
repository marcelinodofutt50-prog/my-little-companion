ALTER TABLE public.partner_service_requests
  ADD COLUMN IF NOT EXISTS ssh_password_enc text,
  ADD COLUMN IF NOT EXISTS form_submitted_at timestamptz;