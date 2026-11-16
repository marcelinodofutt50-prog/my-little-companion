create table public.cakto_subscriptions (
  subscription_id text primary key,
  order_id uuid not null unique references public.orders(id),
  first_payment_id text not null unique,
  canceled boolean not null default false,
  reversed boolean not null default false
);

create table public.cakto_payments (
  payment_id text primary key,
  subscription_id text not null references public.cakto_subscriptions(subscription_id)
);

alter table public.cakto_subscriptions enable row level security;
alter table public.cakto_payments enable row level security;
revoke all on public.cakto_subscriptions, public.cakto_payments from public, anon, authenticated;
grant select, insert, update on public.cakto_subscriptions to service_role;
grant select, insert on public.cakto_payments to service_role;

create function public.apply_cakto_event(
  p_event text, p_subscription text, p_payment text, p_order uuid, p_paid_at timestamptz
)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  sub public.cakto_subscriptions%rowtype;
  target public.licenses%rowtype;
  current_order public.orders%rowtype;
  payment_owner text;
begin
  select * into sub from public.cakto_subscriptions
    where subscription_id = p_subscription for update;

  if not found then
    if p_order is null or p_event not in ('purchase_approved', 'refund', 'chargeback') then
      return jsonb_build_object('action', 'unlinked');
    end if;

    select * into current_order from public.orders where id = p_order for update;
    if not found or current_order.plan_slug <> 'login-30d' or current_order.amount <> 750
        or current_order.status not in ('created', 'pending')
        or current_order.mp_payment_id is not null or current_order.mp_preference_id is not null
        or current_order.metadata -> 'gift' is not null then
      return jsonb_build_object('action', 'rejected');
    end if;

    insert into public.cakto_subscriptions (subscription_id, order_id, first_payment_id)
      values (p_subscription, p_order, p_payment)
      on conflict do nothing returning * into sub;
    if not found then
      return jsonb_build_object('action', 'rejected');
    end if;
    insert into public.cakto_payments (payment_id, subscription_id)
      values (p_payment, p_subscription);
  end if;

  if p_event = 'subscription_canceled' then
    update public.cakto_subscriptions set canceled = true where subscription_id = p_subscription;
    return jsonb_build_object('action', 'done');
  end if;

  select * into target from public.licenses where order_id = sub.order_id for update;

  if p_event in ('refund', 'chargeback') then
    select subscription_id into payment_owner from public.cakto_payments where payment_id = p_payment;
    if payment_owner is not null and payment_owner <> p_subscription then
      return jsonb_build_object('action', 'rejected');
    end if;

    if not sub.reversed then
      update public.cakto_subscriptions set reversed = true where subscription_id = p_subscription;
      update public.orders set status = 'cancelled', next_retry_at = null, processing_at = null
        where id = sub.order_id;
      if target.id is not null then
        update public.licenses set revoked = true, status = 'revoked', expires_at = least(expires_at, now())
          where id = target.id returning * into target;
      end if;
    end if;
    return jsonb_build_object('action', 'revoke', 'email', target.yaarsa_email, 'panel', target.panel);
  end if;

  if sub.reversed then
    return jsonb_build_object('action', 'done');
  end if;

  if p_payment = sub.first_payment_id then
    if target.id is not null then
      update public.orders set status = 'paid', paid_at = coalesce(paid_at, p_paid_at),
        next_retry_at = null, processing_at = null
        where id = sub.order_id and status <> 'paid';
      return jsonb_build_object('action', 'done');
    end if;
    return jsonb_build_object('action', 'fulfill', 'orderId', sub.order_id);
  end if;

  if p_event <> 'subscription_renewed' then
    return jsonb_build_object('action', 'done');
  end if;

  if target.id is null then
    return jsonb_build_object('action', 'unlinked');
  end if;

  select subscription_id into payment_owner from public.cakto_payments where payment_id = p_payment;
  if payment_owner is not null and payment_owner <> p_subscription then
    return jsonb_build_object('action', 'rejected');
  end if;

  if payment_owner is null then
    if sub.canceled or target.revoked or target.disabled_at is not null or target.suspended_at is not null then
      return jsonb_build_object('action', 'done');
    end if;
    insert into public.cakto_payments (payment_id, subscription_id)
      values (p_payment, p_subscription);
    update public.licenses
      set expires_at = greatest(expires_at, p_paid_at) + interval '720 hours', status = 'active'
      where id = target.id returning * into target;
  end if;

  if target.revoked or target.disabled_at is not null or target.suspended_at is not null then
    return jsonb_build_object('action', 'done');
  end if;

  return jsonb_build_object('action', 'sync', 'email', target.yaarsa_email,
    'panel', target.panel, 'expiresAt', target.expires_at);
end;
$$;

revoke execute on function public.apply_cakto_event(text, text, text, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_cakto_event(text, text, text, uuid, timestamptz)
  to service_role;
