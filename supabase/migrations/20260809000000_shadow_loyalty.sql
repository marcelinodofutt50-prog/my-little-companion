-- 1. Enums
create type public.loyalty_status as enum ('pending', 'available', 'used', 'expired', 'revoked');
create type public.loyalty_tier as enum ('starter', 'member', 'bronze', 'silver', 'gold', 'vip', 'elite');

-- 2. Loyalty Tiers Configuration
create table public.loyalty_tier_config (
    id uuid primary key default gen_random_uuid(),
    tier loyalty_tier not null unique,
    name text not null,
    min_points int not null default 0,
    min_days_active int not null default 0,
    badge_url text,
    benefits jsonb default '[]',
    priority int not null default 0,
    created_at timestamptz default now()
);

-- 3. Loyalty Missions
create table public.loyalty_missions (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    requirement_type text not null, -- 'purchase', 'renewal', 'referral', 'community'
    requirement_value int not null,
    reward_points int not null default 0,
    reward_metadata jsonb default '{}',
    active boolean default true,
    starts_at timestamptz,
    ends_at timestamptz,
    limit_per_user int default 1,
    created_at timestamptz default now()
);

-- 4. User Rewards (already exists but we ensure it matches the loyalty requirements)
-- Assuming we might need to extend it or it was defined partially
create table if not exists public.user_rewards (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    reward_type text not null, -- 'coupon', 'trial', 'points', 'badge', 'special'
    reward_value text,
    status loyalty_status not null default 'available',
    metadata jsonb default '{}',
    expires_at timestamptz,
    claimed_at timestamptz,
    created_at timestamptz default now()
);

-- 5. User Loyalty State (Extending profiles or separate table - choosing separate for better audit)
create table public.user_loyalty (
    user_id uuid primary key references auth.users(id) on delete cascade,
    points int not null default 0,
    current_tier loyalty_tier not null default 'starter',
    total_spent numeric(10,2) not null default 0,
    days_active int not null default 0,
    last_action_at timestamptz default now(),
    metadata jsonb default '{}',
    created_at timestamptz default now()
);

-- 6. Loyalty Audit Log (Points, Tiers, etc)
create table public.loyalty_history (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    action_type text not null, -- 'points_earned', 'points_spent', 'tier_up', 'mission_complete'
    amount int,
    description text,
    reference_id uuid, -- link to transaction, mission, etc
    created_at timestamptz default now()
);

-- 7. Grants
grant select on public.loyalty_tier_config to authenticated;
grant select on public.loyalty_missions to authenticated;
grant select, insert, update on public.user_rewards to authenticated;
grant select on public.user_loyalty to authenticated;
grant select on public.loyalty_history to authenticated;

grant all on public.loyalty_tier_config to service_role;
grant all on public.loyalty_missions to service_role;
grant all on public.user_rewards to service_role;
grant all on public.user_loyalty to service_role;
grant all on public.loyalty_history to service_role;

-- 8. RLS
alter table public.loyalty_tier_config enable row level security;
alter table public.loyalty_missions enable row level security;
alter table public.user_rewards enable row level security;
alter table public.user_loyalty enable row level security;
alter table public.loyalty_history enable row level security;

create policy "Anyone can read tiers" on public.loyalty_tier_config for select to authenticated using (true);
create policy "Anyone can read active missions" on public.loyalty_missions for select to authenticated using (active = true);
create policy "Users can read own rewards" on public.user_rewards for select to authenticated using (auth.uid() = user_id);
create policy "Users can read own loyalty" on public.user_loyalty for select to authenticated using (auth.uid() = user_id);
create policy "Users can read own history" on public.loyalty_history for select to authenticated using (auth.uid() = user_id);

-- 9. Initial Seed
insert into public.loyalty_tier_config (tier, name, min_points, min_days_active, priority, benefits) values
('starter', 'Starter', 0, 0, 0, '["Badge Inicial"]'),
('member', 'Member', 500, 7, 1, '["Cupons básicos", "Shadow Points"]'),
('bronze', 'Bronze', 1000, 30, 2, '["Descontos ocasionais", "Melhores recompensas"]'),
('silver', 'Silver', 2500, 90, 3, '["Cupons especiais", "Campanhas exclusivas"]'),
('gold', 'Gold', 5000, 180, 4, '["Benefícios premium", "Recompensas maiores"]'),
('vip', 'VIP', 10000, 365, 5, '["Promoções exclusivas", "Benefícios especiais"]'),
('elite', 'Elite', 25000, 730, 6, '["Benefícios máximos", "Prioridade Alpha"]');

