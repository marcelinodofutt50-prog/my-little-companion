ALTER TABLE public.panel_servers DROP CONSTRAINT IF EXISTS panel_servers_panel_check;
ALTER TABLE public.panel_servers ADD CONSTRAINT panel_servers_panel_check CHECK (panel IN ('v455','v457','v46'));