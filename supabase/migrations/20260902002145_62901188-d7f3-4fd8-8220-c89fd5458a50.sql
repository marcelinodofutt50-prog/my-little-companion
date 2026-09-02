GRANT SELECT, INSERT ON public.product_feedback TO authenticated;
GRANT ALL ON public.product_feedback TO service_role;
CREATE POLICY "feedback_admin_update" ON public.product_feedback FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));