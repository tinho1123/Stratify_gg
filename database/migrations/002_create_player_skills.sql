-- Migration 002: Criar tabelas skills e player_skills
-- Run this AFTER migration 001

-- ─── skills ──────────────────────────────────────────────────────────────────

create table if not exists skills (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

alter table skills enable row level security;

create policy "Skills are viewable by authenticated users"
  on skills for select
  to authenticated
  using (true);

-- Seed: 19 atributos do sistema procedural
insert into skills (name) values
  ('aim'), ('flick'), ('tracking'), ('precisao'), ('recoil_control'),
  ('reacao'), ('movimentacao'), ('strafing'), ('peek'),
  ('leitura'), ('posicionamento'), ('decisao'),
  ('audio'), ('mapa'), ('awareness'),
  ('comunicacao'), ('teamplay'), ('utilitarios');

-- ─── player_skills ────────────────────────────────────────────────────────────

create table if not exists player_skills (
  id        uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  skill_id  uuid not null references skills(id)  on delete cascade,
  value     integer not null default 0 check (value between 0 and 100),
  created_at timestamptz not null default now(),
  unique (player_id, skill_id)
);

alter table player_skills enable row level security;

create policy "Player skills are viewable by authenticated users"
  on player_skills for select
  to authenticated
  using (true);

create policy "Player skills are editable by authenticated users"
  on player_skills for all
  to authenticated
  using (true);
