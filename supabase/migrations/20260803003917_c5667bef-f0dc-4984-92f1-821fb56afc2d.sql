-- Play Protect Bypass System (Public Module)
-- Part of the shadow infrastructure integration

CREATE TYPE public.apk_build_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE public.apk_build_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    app_name TEXT NOT NULL,
    original_apk_url TEXT, -- Supabase Storage URL
    original_icon_url TEXT, -- Supabase Storage URL
    output_apk_url TEXT,   -- Rebuilt & Signed APK
    status public.apk_build_status DEFAULT 'pending' NOT NULL,
    progress INTEGER DEFAULT 0 NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE ON public.apk_build_jobs TO authenticated;
GRANT ALL ON public.apk_build_jobs TO service_role;

ALTER TABLE public.apk_build_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own build jobs" 
ON public.apk_build_jobs FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create build jobs" 
ON public.apk_build_jobs FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_apk_job_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_apk_job_updated
    BEFORE UPDATE ON public.apk_build_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_apk_job_updated();
