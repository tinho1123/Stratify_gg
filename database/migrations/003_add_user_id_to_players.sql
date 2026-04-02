-- Migration 003: Add user_id to players and update RLS
-- Run this AFTER migrations 001 and 002

-- Adiciona coluna user_id (nullable para não quebrar dados antigos)
alter table players
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Recria as policies para filtrar por user_id
drop policy if exists "Players are viewable by authenticated users" on players;
drop policy if exists "Players are editable by authenticated users" on players;

create policy "Users can view their own players"
  on players for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert their own players"
  on players for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own players"
  on players for update
  to authenticated
  using (user_id = auth.uid());

create policy "Users can delete their own players"
  on players for delete
  to authenticated
  using (user_id = auth.uid());

-- Atualiza o RLS de player_skills para seguir o dono do player
drop policy if exists "Player skills are viewable by authenticated users" on player_skills;
drop policy if exists "Player skills are editable by authenticated users" on player_skills;

create policy "Users can view skills of their own players"
  on player_skills for select
  to authenticated
  using (
    exists (
      select 1 from players p
      where p.id = player_skills.player_id
        and p.user_id = auth.uid()
    )
  );

create policy "Users can manage skills of their own players"
  on player_skills for all
  to authenticated
  using (
    exists (
      select 1 from players p
      where p.id = player_skills.player_id
        and p.user_id = auth.uid()
    )
  );
