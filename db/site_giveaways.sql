create table if not exists public.site_giveaways (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  prize text not null,
  description text,
  min_account_days int not null default 7,
  require_nickname boolean not null default true,
  require_avatar boolean not null default false,
  require_paid boolean not null default false,
  status text not null default 'open',
  winner_user_id uuid,
  winner_label text,
  eligible_count int,
  announcement_id uuid,
  created_by uuid,
  drawn_by uuid,
  drawn_at timestamptz,
  created_at timestamptz not null default now()
);
grant all on public.site_giveaways to service_role;
grant select on public.site_giveaways to authenticated;
alter table public.site_giveaways enable row level security;
drop policy if exists "staff read giveaways" on public.site_giveaways;
create policy "staff read giveaways" on public.site_giveaways for select to authenticated using (public.is_staff(auth.uid()));

create or replace function public.giveaway_eligible_users(_id uuid)
returns table(user_id uuid, label text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name
  from public.site_giveaways g
  join public.profiles p on true
  join auth.users u on u.id = p.id
  where g.id = _id
    and u.email_confirmed_at is not null
    and u.created_at <= now() - make_interval(days => g.min_account_days)
    and (not g.require_nickname or (coalesce(btrim(p.display_name),'') <> '' and p.display_name <> split_part(p.email,'@',1)))
    and (not g.require_avatar or coalesce(p.avatar_url,'') <> '')
    and (not g.require_paid or exists (select 1 from public.licenses l where l.user_id=p.id and l.is_trial=false and l.revoked=false))
    and not exists (select 1 from public.user_roles r where r.user_id=p.id and r.role in ('admin','moderator','support'))
    and not exists (select 1 from public.account_bans b where b.user_id=p.id and b.revoked_at is null)
    and not exists (select 1 from public.trial_blocks t where t.user_id=p.id)
    and not exists (select 1 from public.site_giveaways w where w.winner_user_id=p.id and w.drawn_at > now() - interval '30 days')
$$;
revoke all on function public.giveaway_eligible_users(uuid) from public, anon, authenticated;
grant execute on function public.giveaway_eligible_users(uuid) to service_role;
