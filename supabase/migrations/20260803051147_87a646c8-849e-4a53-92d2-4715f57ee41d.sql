ALTER TABLE public.announcements ADD COLUMN status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published'));
UPDATE public.announcements SET status = 'published' WHERE is_active = true;
UPDATE public.announcements SET status = 'draft' WHERE is_active = false;