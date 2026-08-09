create type public.referral_reward_status as enum ('pending', 'confirmed', 'released', 'cancelled', 'revogated');
create type public.referral_reward_type as enum ('points', 'cashback', 'coupon', 'level_up');
create type public.shadow_reward_level as enum ('novato', 'bronze', 'prata', 'ouro', 'elite', 'legend');

-- Tabela de Configuração de Níveis (Admin)
create table public.reward_level_config (
    id uuid primary key default gen_random_uuid(),
    level public.shadow_reward_level not null unique,
    name text not null,
    min_referrals integer not null default 0,
    min_conversions integer not null default 0,
    benefits text[] default '{}',
    badge_url text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Tabela de Recompensas Configuráveis (Admin)
create table public.reward_config (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    requirement_type text not null, -- 'referral_count', 'conversion_count', 'specific_event'
    requirement_value integer not null,
    reward_type public.referral_reward_type not null,
    reward_value jsonb not null, -- { type: 'percent', amount: 10 } ou { points: 100 }
    is_active boolean default true,
    created_at timestamp with time zone default now()
);

-- Evolução da tabela de Perfis para suportar Rewards
alter table public.profiles 
add column if not exists reward_points integer default 0,
add column if not exists current_level public.shadow_reward_level default 'novato',
add column if not exists trust_score integer default 100,
add column if not exists referrals_valid_count integer default 0,
add column if not exists conversions_count integer default 0;

-- Tabela de Recompensas de Usuários (Instâncias)
create table public.user_rewards (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    config_id uuid references public.reward_config(id),
    status public.referral_reward_status not null default 'pending',
    type public.referral_reward_type not null,
    value jsonb not null,
    claimed_at timestamp with time zone,
    created_at timestamp with time zone default now(),
    metadata jsonb default '{}'
);

-- Tabela de Eventos de Indicação (Log Antifraude)
create table public.referral_events (
    id uuid primary key default gen_random_uuid(),
    referral_id uuid references public.referrals(id),
    event_type text not null, -- 'signup', 'onboarding', 'purchase', 'recurring'
    status text not null default 'pending',
    metadata jsonb default '{}',
    created_at timestamp with time zone default now()
);

-- Grants
grant select, insert, update on public.user_rewards to authenticated;
grant select on public.reward_level_config to authenticated;
grant select on public.reward_config to authenticated;
grant select, insert on public.referral_events to authenticated;

grant all on public.reward_level_config to service_role;
grant all on public.reward_config to service_role;
grant all on public.user_rewards to service_role;
grant all on public.referral_events to service_role;

-- RLS
alter table public.reward_level_config enable row level security;
alter table public.reward_config enable row level security;
alter table public.user_rewards enable row level security;
alter table public.referral_events enable row level security;

create policy "Users can view reward configs" on public.reward_config for select to authenticated using (true);
create policy "Users can view levels" on public.reward_level_config for select to authenticated using (true);
create policy "Users can view own rewards" on public.user_rewards for select to authenticated using (auth.uid() = user_id);
create policy "Users can view own referral events" on public.referral_events for select to authenticated 
using (exists (select 1 from public.referrals where id = referral_id and referrer_id = auth.uid()));

-- Seeds Iniciais
insert into public.reward_level_config (level, name, min_referrals, min_conversions, benefits)
values 
('novato', 'Novato', 0, 0, '{"Código personalizado", "Recompensas básicas"}'),
('bronze', 'Bronze', 5, 1, '{"Cupons melhores", "Recompensas adicionais"}'),
('prata', 'Prata', 15, 3, '{"Cupons premium", "Benefícios exclusivos"}'),
('ouro', 'Ouro', 30, 7, '{"Recompensas especiais", "Prioridade Staff"}'),
('elite', 'Elite', 60, 15, '{"Reconhecimento comunidade", "Candidatura prioritária Staff"}'),
('legend', 'Legend', 150, 40, '{"Benefícios lendários customizados"}');
