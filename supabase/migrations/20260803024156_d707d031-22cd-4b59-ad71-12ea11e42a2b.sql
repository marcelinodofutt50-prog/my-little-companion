ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.support_messages(id);
NOTIFY pgrst, 'reload schema';