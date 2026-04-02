-- Migration 002: Create player_skills table
-- Run this AFTER migration 001
-- Run this in the Supabase SQL Editor

create table if not exists player_skills (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  skill_name text not null,
  value integer not null default 0 check (value between 0 and 100),
  created_at timestamptz not null default now(),
  unique (player_id, skill_name)
);

-- Enable Row Level Security
alter table player_skills enable row level security;

-- Policy: allow authenticated users to read all skills
create policy "Player skills are viewable by authenticated users"
  on player_skills for select
  to authenticated
  using (true);

-- Policy: allow authenticated users to insert/update skills
create policy "Player skills are editable by authenticated users"
  on player_skills for all
  to authenticated
  using (true);

-- Seed data: skills per player
-- Using a subquery to get the UUIDs inserted by migration 001
insert into player_skills (player_id, skill_name, value)
select p.id, skill.skill_name, skill.value
from players p
cross join (values
  ('Alice',   'Mira',              78),
  ('Alice',   'Leitura de Jogo',   95),
  ('Alice',   'Comunicação',       98),
  ('Alice',   'Clutch',            82),
  ('Alice',   'Uso de Utilitários',88),
  ('Alice',   'Posicionamento',    91),

  ('Bob',     'Mira',              96),
  ('Bob',     'Leitura de Jogo',   80),
  ('Bob',     'Comunicação',       74),
  ('Bob',     'Clutch',            90),
  ('Bob',     'Uso de Utilitários',70),
  ('Bob',     'Posicionamento',    85),

  ('Charlie', 'Mira',              72),
  ('Charlie', 'Leitura de Jogo',   84),
  ('Charlie', 'Comunicação',       93),
  ('Charlie', 'Clutch',            68),
  ('Charlie', 'Uso de Utilitários',97),
  ('Charlie', 'Posicionamento',    88),

  ('Diana',   'Mira',              92),
  ('Diana',   'Leitura de Jogo',   78),
  ('Diana',   'Comunicação',       80),
  ('Diana',   'Clutch',            88),
  ('Diana',   'Uso de Utilitários',72),
  ('Diana',   'Posicionamento',    76),

  ('Eve',     'Mira',              84),
  ('Eve',     'Leitura de Jogo',   87),
  ('Eve',     'Comunicação',       86),
  ('Eve',     'Clutch',            83),
  ('Eve',     'Uso de Utilitários',85),
  ('Eve',     'Posicionamento',    89)
) as skill(player_name, skill_name, value)
where p.name = skill.player_name;
