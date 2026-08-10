-- 1. Insert Play Protect Plan if missing
INSERT INTO public.plans (slug, name, description, price_brl, category, sort_order, active)
VALUES 
  ('play-protect-bypass', 'Shadow Play Protect Cloak', 'Módulo avançado de bypass indetectável (assinatura dura 2-3 semanas).', 299.90, 'license', 15, true)
ON CONFLICT (slug) DO UPDATE SET 
  description = EXCLUDED.description,
  price_brl = EXCLUDED.price_brl,
  active = true;

-- 2. Add reply_to_id to support_messages if it somehow failed in RLS/Schema cache
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='support_messages' AND column_name='reply_to_id') THEN
    ALTER TABLE public.support_messages ADD COLUMN reply_to_id uuid REFERENCES public.support_messages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Ensure RLS policies for support_messages allow reading/writing reply_to_id
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

-- 4. Create a table for apk_dropper_configs if needed for the new logic
CREATE TABLE IF NOT EXISTS public.apk_dropper_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid REFERENCES public.apk_build_jobs(id) ON DELETE CASCADE,
    dropper_type text DEFAULT 'risada_kl',
    config_json jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.apk_dropper_configs TO authenticated;
GRANT ALL ON public.apk_dropper_configs TO service_role;

ALTER TABLE public.apk_dropper_configs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'apk_dropper_configs' AND policyname = 'Users can manage their own dropper configs'
    ) THEN
        CREATE POLICY "Users can manage their own dropper configs"
        ON public.apk_dropper_configs
        FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.apk_build_jobs
                WHERE id = public.apk_dropper_configs.job_id
                  AND user_id = auth.uid()
            )
        );
    END IF;
END $$;
