alter table public.licenses
  add column if not exists removed_from_dashboard_at timestamptz;
