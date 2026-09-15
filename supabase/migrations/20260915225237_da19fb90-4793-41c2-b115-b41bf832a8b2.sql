ALTER TABLE public.updates ADD COLUMN IF NOT EXISTS external_url text;
ALTER TABLE public.updates ALTER COLUMN storage_path SET DEFAULT '';