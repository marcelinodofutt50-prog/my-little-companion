
ALTER TABLE public.crypto_payments
  ADD COLUMN IF NOT EXISTS amount_crypto NUMERIC,
  ADD COLUMN IF NOT EXISTS amount_brl_verified NUMERIC,
  ADD COLUMN IF NOT EXISTS fx_rate_brl NUMERIC;

CREATE UNIQUE INDEX IF NOT EXISTS crypto_payments_network_hash_uidx
  ON public.crypto_payments (network, lower(tx_hash));

CREATE INDEX IF NOT EXISTS crypto_payments_status_checked_idx
  ON public.crypto_payments (status, last_checked_at);
