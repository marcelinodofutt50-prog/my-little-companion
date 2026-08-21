ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS password_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS password_sync_status text,
  ADD COLUMN IF NOT EXISTS password_sync_error text,
  ADD COLUMN IF NOT EXISTS password_sync_by uuid;