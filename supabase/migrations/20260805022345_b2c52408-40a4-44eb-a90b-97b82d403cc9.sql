ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_fulfillment_error text;

CREATE INDEX IF NOT EXISTS idx_orders_retry ON public.orders (status, next_retry_at);