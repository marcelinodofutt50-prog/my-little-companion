ALTER TABLE public.support_threads ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'outro';
ALTER TABLE public.support_threads ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';
CREATE INDEX IF NOT EXISTS support_threads_category_idx ON public.support_threads (category);