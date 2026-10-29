GRANT UPDATE (giveaway_title, nickname, prize_label, awarded_on) ON public.giveaway_winner_board TO authenticated;
CREATE POLICY winner_board_admin_update ON public.giveaway_winner_board FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND public.mfa_satisfied()) WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.mfa_satisfied());
NOTIFY pgrst, 'reload schema';