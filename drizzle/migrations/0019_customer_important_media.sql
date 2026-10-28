CREATE TABLE public.customer_important_media (
 message_id uuid PRIMARY KEY REFERENCES public.support_messages(id) ON DELETE CASCADE,
 marked_by uuid NOT NULL,
 marked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.customer_important_media TO authenticated;
GRANT ALL ON public.customer_important_media TO service_role;
ALTER TABLE public.customer_important_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY important_media_admin_read ON public.customer_important_media FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') AND public.mfa_satisfied());
CREATE POLICY important_media_admin_insert ON public.customer_important_media FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.mfa_satisfied() AND marked_by = auth.uid() AND EXISTS (SELECT 1 FROM public.support_messages m WHERE m.id = message_id AND m.attachment_url IS NOT NULL));
CREATE POLICY important_media_admin_delete ON public.customer_important_media FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND public.mfa_satisfied());
COMMENT ON TABLE public.customer_important_media IS 'Private admin bookmarks of original support attachments; never payment approval. Customer identity is derived from the original conversation.';