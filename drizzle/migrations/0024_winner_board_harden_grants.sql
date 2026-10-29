REVOKE ALL ON public.giveaway_winner_board FROM anon, authenticated;
REVOKE SELECT (created_by) ON public.giveaway_winner_board FROM anon, authenticated;
GRANT SELECT (id, giveaway_title, nickname, prize_label, awarded_on, created_at) ON public.giveaway_winner_board TO anon, authenticated;
GRANT INSERT, DELETE ON public.giveaway_winner_board TO authenticated;
NOTIFY pgrst, 'reload schema';