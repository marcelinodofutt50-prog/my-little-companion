CREATE TABLE public.giveaway_winner_board (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_title text NOT NULL CHECK (char_length(giveaway_title) BETWEEN 3 AND 100),
  nickname text NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 24),
  prize_label text NOT NULL CHECK (char_length(prize_label) BETWEEN 2 AND 120),
  awarded_on date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Sem acesso direto de clientes: leitura pública e escrita admin passam por funções de servidor.
GRANT ALL ON public.giveaway_winner_board TO service_role;
ALTER TABLE public.giveaway_winner_board ENABLE ROW LEVEL SECURITY;
CREATE INDEX giveaway_winner_board_awarded_idx ON public.giveaway_winner_board (awarded_on DESC, created_at DESC);