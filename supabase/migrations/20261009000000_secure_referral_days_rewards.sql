-- Secure, idempotent referral rewards: 3 extra days for the referrer after
-- the referred customer's first paid order. The referred customer's existing
-- 3-day welcome trial remains guarded by activateTrialReward().
create table if not exists public.referral_reward_grants (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  referrer_id uuid not null references public.profiles(id) on delete restrict,
  referred_id uuid not null references public.profiles(id) on delete restrict,
  reward_days integer not null default 3 check (reward_days = 3),
  status text not null default 'pending' check (status in ('pending','granted','pending_no_license')),
  created_at timestamptz not null default now(),
  granted_at timestamptz
);

create table if not exists public.referral_reward_license_targets (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.referral_reward_grants(id) on delete cascade,
  license_id uuid not null references public.licenses(id) on delete restrict,
  target_expires_at timestamptz not null,
  panel text,
  yaarsa_email text,
  synced_at timestamptz,
  unique (grant_id, license_id)
);

alter table public.referral_reward_grants enable row level security;
alter table public.referral_reward_license_targets enable row level security;
revoke all on public.referral_reward_grants from anon, authenticated;
revoke all on public.referral_reward_license_targets from anon, authenticated;

create or replace function public.prepare_referral_purchase_reward(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_grant public.referral_reward_grants%rowtype;
  v_existing_referral public.referrals%rowtype;
  v_targets jsonb;
  v_count integer := 0;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status <> 'paid' or v_order.referrer_id is null
     or v_order.referrer_id = v_order.user_id then
    return jsonb_build_object('ok', false, 'reason', 'not-eligible');
  end if;

  -- Serialize eligibility checks per referred account so concurrent webhooks
  -- cannot issue duplicate rewards for separate orders.
  perform pg_advisory_xact_lock(hashtextextended(v_order.user_id::text, 0));

  if exists (
    select 1 from public.orders o
    where o.user_id = v_order.user_id and o.status = 'paid' and o.id <> v_order.id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not-first-paid-order');
  end if;

  -- Signup-time attribution is authoritative. Never grant if an old or
  -- inconsistent referral row points to a different person.
  if exists (
    select 1 from public.referrals r
    where r.referred_id = v_order.user_id and r.referrer_id <> v_order.referrer_id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'attribution-mismatch');
  end if;

  select * into v_grant from public.referral_reward_grants where order_id = p_order_id for update;
  if not found then
    insert into public.referral_reward_grants(order_id, referrer_id, referred_id, reward_days, status)
    values (v_order.id, v_order.referrer_id, v_order.user_id, 3, 'pending')
    returning * into v_grant;

    -- Snapshot deterministic absolute target dates once. Retries can safely
    -- re-apply the same expiry to the external panel without adding days twice.
    insert into public.referral_reward_license_targets
      (grant_id, license_id, target_expires_at, panel, yaarsa_email)
    select v_grant.id, l.id, greatest(l.expires_at, now()) + interval '3 days',
           l.panel, l.yaarsa_email
    from public.licenses l
    where l.user_id = v_order.referrer_id
      and coalesce(l.revoked, false) = false
      and l.disabled_at is null
      and coalesce(l.is_trial, false) = false
      and l.expires_at is not null;

    update public.licenses l
       set expires_at = t.target_expires_at
      from public.referral_reward_license_targets t
     where t.grant_id = v_grant.id and t.license_id = l.id;

    get diagnostics v_count = row_count;
    if v_count = 0 then
      update public.referral_reward_grants set status = 'pending_no_license' where id = v_grant.id;
    end if;

    -- Signup attribution may already have created the referral row. Update it
    -- instead of treating its existence as proof that a reward was delivered.
    select * into v_existing_referral from public.referrals
      where referred_id = v_order.user_id
      order by created_at asc limit 1 for update;
    if found then
      update public.referrals
         set order_id = v_order.id,
             reward_type = 'free_month',
             reward_amount = 3,
             reward_status = case when v_count > 0 then 'pending' else 'pending' end,
             notes = 'Recompensa de indicação: 3 dias extras de acesso'
       where id = v_existing_referral.id;
    else
      insert into public.referrals
        (referrer_id, referred_id, order_id, reward_type, reward_amount, reward_status, notes)
      values
        (v_order.referrer_id, v_order.user_id, v_order.id, 'free_month', 3, 'pending',
         'Recompensa de indicação: 3 dias extras de acesso');
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'license_id', t.license_id, 'target_expires_at', t.target_expires_at,
    'panel', t.panel, 'yaarsa_email', t.yaarsa_email, 'synced', t.synced_at is not null
  )), '[]'::jsonb)
  into v_targets
  from public.referral_reward_license_targets t where t.grant_id = v_grant.id;

  return jsonb_build_object(
    'ok', true, 'grant_id', v_grant.id, 'status', v_grant.status,
    'referrer_id', v_grant.referrer_id, 'referred_id', v_grant.referred_id,
    'reward_days', v_grant.reward_days, 'targets', v_targets
  );
end;
$$;

create or replace function public.mark_referral_reward_license_synced(p_target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_grant_id uuid;
begin
  update public.referral_reward_license_targets
     set synced_at = coalesce(synced_at, now())
   where id = p_target_id
   returning grant_id into v_grant_id;
  if v_grant_id is null then return false; end if;

  if not exists (
    select 1 from public.referral_reward_license_targets
     where grant_id = v_grant_id and synced_at is null
  ) then
    update public.referral_reward_grants
       set status = 'granted', granted_at = coalesce(granted_at, now())
     where id = v_grant_id;
    update public.referrals
       set reward_status = 'granted',
           status = 'converted',
           notes = 'Recompensa entregue: 3 dias extras de acesso'
     where order_id = (select order_id from public.referral_reward_grants where id = v_grant_id);
  end if;
  return true;
end;
$$;

revoke all on function public.prepare_referral_purchase_reward(uuid) from public, anon, authenticated;
revoke all on function public.mark_referral_reward_license_synced(uuid) from public, anon, authenticated;
grant execute on function public.prepare_referral_purchase_reward(uuid) to service_role;
grant execute on function public.mark_referral_reward_license_synced(uuid) to service_role;
