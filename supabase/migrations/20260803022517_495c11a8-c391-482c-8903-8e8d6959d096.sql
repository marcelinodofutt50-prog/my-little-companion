-- Fix trial ip_hash column
ALTER TABLE public.trials ADD COLUMN IF NOT EXISTS ip_hash text;

-- Ensure schema cache is updated and permissions are correct
GRANT ALL ON public.trials TO authenticated, service_role;
GRANT ALL ON public.apk_build_jobs TO authenticated, service_role;
GRANT ALL ON public.support_threads TO authenticated, service_role;
GRANT ALL ON public.support_messages TO authenticated, service_role;

-- Add index for ip_hash if missing
CREATE INDEX IF NOT EXISTS trials_ip_hash_idx ON public.trials (ip_hash);
