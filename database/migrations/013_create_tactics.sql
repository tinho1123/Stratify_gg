-- Migration 013: Tabela de táticas do time
-- Run this AFTER migration 012

create table if not exists tactics (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null unique references teams(id) on delete cascade,
  game_style        text not null default 'adaptativo'
                      check (game_style in ('agressivo', 'adaptativo', 'controlado')),
  eco_strategy      text not null default 'balanceado'
                      check (eco_strategy in ('economico', 'balanceado', 'full_buy')),
  map_pool          text[] not null default '{"Mirage","Inferno","Nuke"}',
  role_assignments  jsonb not null default '{}',
  updated_at        timestamptz not null default now()
);

alter table tactics enable row level security;

create policy "Users can view their own tactics"
  on tactics for select
  to authenticated
  using (team_id in (select id from teams where user_id = auth.uid()));

create policy "Users can upsert their own tactics"
  on tactics for all
  to authenticated
  using (team_id in (select id from teams where user_id = auth.uid()))
  with check (team_id in (select id from teams where user_id = auth.uid()));
