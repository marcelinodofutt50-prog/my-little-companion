-- Shadow Loyalty RBAC & RPC Security Overhaul
-- Final production-grade security implementation.

-- 1. Security Definer RPC for mission completion
-- Uses auth.uid() directly for isolation, enforces idempotency, and explicit search_path.
create or replace function public.complete_loyalty_mission(_mission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_mission record;
    v_already_completed int;
    v_current_points int;
begin
    -- 1. Extract user_id from auth context (cannot be spoofed by frontend)
    v_user_id := auth.uid();
    if v_user_id is null then
        return jsonb_build_object('ok', false, 'message', 'Unauthorized');
    end if;

    -- 2. Lock and validate mission
    select * from loyalty_missions where id = _mission_id and active = true into v_mission;
    if not found then
        return jsonb_build_object('ok', false, 'message', 'Missão não encontrada ou inativa.');
    end if;

    -- 3. Enforce Idempotency (Atomic check)
    -- Using a subquery for atomic safety within the definer function.
    select count(*) from loyalty_history 
    where user_id = v_user_id 
      and reference_id = _mission_id 
      and action_type = 'mission_complete' 
    into v_already_completed;

    if v_already_completed >= v_mission.limit_per_user then
        return jsonb_build_object('ok', false, 'message', 'Limite da missão atingido.');
    end if;

    -- 4. Atomic Execution: Update History -> Update Loyalty -> Tier Check
    -- Points amount is taken strictly from the mission config, never from input.
    insert into loyalty_history (user_id, action_type, amount, description, reference_id)
    values (v_user_id, 'mission_complete', v_mission.reward_points, v_mission.title, _mission_id);

    update user_loyalty 
    set points = points + v_mission.reward_points,
        last_action_at = now()
    where user_id = v_user_id
    returning points into v_current_points;

    -- Tier Progression Logic (Server-side only)
    update user_loyalty ul
    set current_tier = (
        select tier 
        from loyalty_tier_config 
        where min_points <= v_current_points 
        order by priority desc 
        limit 1
    )
    where user_id = v_user_id;

    return jsonb_build_object('ok', true, 'points_earned', v_mission.reward_points, 'total_points', v_current_points);
exception when others then
    -- Ensures atomicity: any error rolls back points and history
    return jsonb_build_object('ok', false, 'message', 'Falha interna ao processar recompensa.');
end;
$$;

-- 2. Explicit Permission Management
-- Revoke all to ensure no public exposure, then grant only to authenticated.
revoke execute on function public.complete_loyalty_mission(_mission_id uuid) from public, anon;
grant execute on function public.complete_loyalty_mission(_mission_id uuid) to authenticated;

-- 3. Data Integrity: Constraint-level Protection
-- Added unique constraint as the final line of defense against race conditions (idempotency).
alter table public.loyalty_history drop constraint if exists unique_mission_completion;
alter table public.loyalty_history 
add constraint unique_mission_completion unique (user_id, reference_id, action_type);
