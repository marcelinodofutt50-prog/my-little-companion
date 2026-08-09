-- Add status column to plans table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_status') THEN
        CREATE TYPE public.plan_status AS ENUM ('published', 'draft', 'hidden', 'sold_out');
    END IF;
END $$;

ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS status public.plan_status DEFAULT 'published';

-- Update grants to ensure it's visible to Data API
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
