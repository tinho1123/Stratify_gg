-- Migration 006: Tabela de times e trigger para criar time inicial
-- Run this AFTER migration 005

create table if not exists teams (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  name       text not null default 'Meu Time',
  budget     integer not null default 10000,
  ranking    integer,                          -- null = sem ranking ainda
  fans       integer not null default 0,
  wins       integer not null default 0,
  losses     integer not null default 0,
  onboarded  boolean not null default false,   -- false = ainda não escolheu nome
  created_at timestamptz not null default now()
);

-- RLS
alter table teams enable row level security;

create policy "Users can view their own team"
  on teams for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can update their own team"
  on teams for update
  to authenticated
  using (user_id = auth.uid());

-- Trigger: cria time inicial ao cadastrar (onboarded = false até escolher nome)
create or replace function create_starter_team()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into teams (user_id, name, budget, ranking, fans, wins, losses, onboarded)
  values (new.id, 'Meu Time', 10000, null, 0, 0, 0, false);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_team on auth.users;

create trigger on_auth_user_created_team
  after insert on auth.users
  for each row
  execute function create_starter_team();
