ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.support_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS support_messages_reply_to_id_idx ON public.support_messages(reply_to_id);