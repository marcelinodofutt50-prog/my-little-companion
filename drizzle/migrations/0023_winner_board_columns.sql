REVOKE SELECT ON public.giveaway_winner_board FROM authenticated;
GRANT SELECT (id, giveaway_title, nickname, prize_label, awarded_on, created_at) ON public.giveaway_winner_board TO anon, authenticated;
GRANT INSERT, DELETE ON public.giveaway_winner_board TO authenticated;
NOTIFY pgrst, 'reload schema';