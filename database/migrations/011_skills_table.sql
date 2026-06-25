-- Migration 011: Criar tabela skills e migrar player_skills para usar skill_id
-- Run this AFTER migration 010

-- ─── Criar tabela skills ──────────────────────────────────────────────────────

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
  ('comunicacao'), ('teamplay'), ('utilitarios')
on conflict (name) do nothing;

-- ─── Migrar player_skills ─────────────────────────────────────────────────────

-- Remover dados antigos (incompatíveis com o novo schema)
delete from player_skills;

-- Trocar skill_name (text) por skill_id (uuid)
alter table player_skills
  drop column if exists skill_name,
  add column skill_id uuid not null references skills(id) on delete cascade;

-- Atualizar unique constraint
alter table player_skills
  drop constraint if exists player_skills_player_id_skill_name_key;

alter table player_skills
  add constraint player_skills_player_id_skill_id_key
  unique (player_id, skill_id);
