-- Adicionar permissões de Staff para o Loyalty Management
-- Inserir nova capacidade se necessário, embora tutorials.manage ou view.system possam cobrir
-- Por agora, garantimos que o admin tenha acesso total.

-- Função para processar missões no backend (Idempotente)
create or replace function public.complete_loyalty_mission(_user_id uuid, _mission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_mission record;
    v_already_completed int;
    v_reward_id uuid;
begin
    -- 1. Lock mission
    select * from loyalty_missions where id = _mission_id and active = true into v_mission;
    if not found then
        return jsonb_build_object('ok', false, 'message', 'Missão não encontrada ou inativa.');
    end if;

    -- 2. Check limits
    select count(*) from loyalty_history 
    where user_id = _user_id and reference_id = _mission_id and action_type = 'mission_complete' 
    into v_already_completed;

    if v_already_completed >= v_mission.limit_per_user then
        return jsonb_build_object('ok', false, 'message', 'Limite da missão atingido.');
    end if;

    -- 3. Grant points
    insert into loyalty_history (user_id, action_type, amount, description, reference_id)
    values (_user_id, 'mission_complete', v_mission.reward_points, v_mission.title, _mission_id);

    update user_loyalty 
    set points = points + v_mission.reward_points,
        last_action_at = now()
    where user_id = _user_id;

    -- 4. Check for tier upgrade
    -- This would normally be a trigger, but we can call a tier check function here

    return jsonb_build_object('ok', true, 'points_earned', v_mission.reward_points);
end;
$$;

grant execute on function public.complete_loyalty_mission to authenticated;
