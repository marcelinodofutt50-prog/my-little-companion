ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_display_name_lower_key
  ON public.profiles (lower(display_name))
  WHERE display_name IS NOT NULL;