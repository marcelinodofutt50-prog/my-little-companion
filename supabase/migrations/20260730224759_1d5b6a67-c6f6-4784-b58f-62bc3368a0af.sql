CREATE TABLE IF NOT EXISTS public.panel_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel text NOT NULL UNIQUE CHECK (panel IN ('v457','v46')),
  label text NOT NULL DEFAULT '',
  base_url text NOT NULL,
  admin_key_enc text NOT NULL,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_by_email text,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.panel_servers TO service_role;
ALTER TABLE public.panel_servers ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_panel_servers_updated_at ON public.panel_servers;
CREATE TRIGGER trg_panel_servers_updated_at BEFORE UPDATE ON public.panel_servers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();