DROP FUNCTION IF EXISTS public.force_refresh_schema_permissions();

-- Re-grant everything explicitly
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Ensure tutorials exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tutorials') THEN
        CREATE TABLE public.tutorials (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT NOT NULL,
            description TEXT,
            video_url TEXT,
            image_url TEXT,
            youtube_url TEXT,
            category TEXT DEFAULT 'Geral',
            is_active BOOLEAN DEFAULT true,
            display_order INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now(),
            created_by UUID REFERENCES auth.users(id)
        );
        
        INSERT INTO public.tutorials (title, description, category, is_active)
        VALUES ('Introdução ao Shadow', 'Bem-vindo ao ecossistema de elite.', 'Básico', true);
    END IF;
END $$;

-- Explicit Grants
GRANT ALL ON public.tutorials TO authenticated;
GRANT SELECT ON public.tutorials TO anon;
GRANT ALL ON public.tutorials TO service_role;

-- Recreate the emergency repair function
CREATE OR REPLACE FUNCTION public.force_refresh_schema_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- This touch forces PostgREST to re-examine the schema
    EXECUTE 'NOTIFY pgrst, ''reload schema''';
    
    -- Re-apply grants inside to be extra sure
    EXECUTE 'GRANT SELECT ON public.tutorials TO anon, authenticated';
    EXECUTE 'GRANT ALL ON public.tutorials TO authenticated';
    EXECUTE 'GRANT ALL ON public.tutorials TO service_role';
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.force_refresh_schema_permissions() TO service_role;
