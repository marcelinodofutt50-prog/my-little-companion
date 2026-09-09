ALTER TABLE public.redeem_codes DROP CONSTRAINT IF EXISTS redeem_codes_kind_check;
ALTER TABLE public.redeem_codes ADD CONSTRAINT redeem_codes_kind_check
  CHECK (kind = ANY (ARRAY['license_days'::text, 'server_renewal'::text, 'partner_access'::text]));