-- 1. Remover função antiga para evitar erro de assinatura (42P13)
DROP FUNCTION IF EXISTS public.force_refresh_schema_permissions();

-- 2. Garantir recarga do schema tocando no PostgREST
NOTIFY pgrst, 'reload schema';

-- 3. Backup e Recriação da tabela
CREATE TABLE IF NOT EXISTS public.tutorials_backup AS SELECT * FROM public.tutorials;
DROP TABLE IF EXISTS public.tutorials CASCADE;

CREATE TABLE public.tutorials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    video_url TEXT,
    image_url TEXT,
    youtube_url TEXT,
    category TEXT NOT NULL DEFAULT 'Geral',
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Restaurar dados do backup
INSERT INTO public.tutorials (id, title, description, video_url, image_url, youtube_url, category, is_active, display_order, created_by, created_at, updated_at)
SELECT id, title, description, video_url, image_url, youtube_url, category, is_active, display_order, created_by, created_at, updated_at
FROM public.tutorials_backup
ON CONFLICT (id) DO NOTHING;

DROP TABLE IF EXISTS public.tutorials_backup;

-- 5. Permissões
GRANT SELECT ON public.tutorials TO anon;
GRANT SELECT ON public.tutorials TO authenticated;
GRANT ALL ON public.tutorials TO service_role;

-- 6. RLS
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public tutorials are viewable by everyone" 
ON public.tutorials FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage tutorials" 
ON public.tutorials FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. Recriar função de refresh de permissões com USAGE garantido
CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Re-grant USAGE no schema public
  EXECUTE 'GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role';
  
  -- Garantir permissões nas tabelas críticas
  EXECUTE 'GRANT SELECT ON public.tutorials TO anon, authenticated';
  EXECUTE 'GRANT ALL ON public.tutorials TO service_role';
  
  -- Notify PostgREST to reload schema cache
  NOTIFY pgrst, 'reload schema';
END;
$$;

-- 8. Executar refresh imediatamente
SELECT public.force_refresh_schema_permissions();