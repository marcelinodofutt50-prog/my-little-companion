GRANT SELECT (nickname, awarded_on, created_at) ON public.giveaway_winner_board TO anon;
GRANT SELECT, INSERT, DELETE ON public.giveaway_winner_board TO authenticated;
CREATE POLICY winner_board_public_read ON public.giveaway_winner_board FOR SELECT TO anon USING (true);
CREATE POLICY winner_board_member_read ON public.giveaway_winner_board FOR SELECT TO authenticated USING (true);
CREATE POLICY winner_board_admin_insert ON public.giveaway_winner_board FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.mfa_satisfied() AND created_by = auth.uid());
CREATE POLICY winner_board_admin_delete ON public.giveaway_winner_board FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND public.mfa_satisfied());
NOTIFY pgrst, 'reload schema';