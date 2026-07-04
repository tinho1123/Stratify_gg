-- Migration 014: Tabela de partidas agendadas e disputadas
-- Run this AFTER migration 013

create table if not exists matches (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references teams(id) on delete cascade,
  opponent_team_id  uuid references teams(id),   -- null = bot gerado pelo sistema
  opponent_name     text not null,               -- snapshot do nome no momento da geração
  opponent_rating   integer not null default 60, -- snapshot do rating médio
  scheduled_for     timestamptz not null,        -- quando a partida acontece
  status            text not null default 'scheduled'
                      check (status in ('scheduled', 'played', 'cancelled')),
  result            text check (result in ('win', 'loss')),
  score_own         integer,
  score_opp         integer,
  map               text,
  match_type        text not null default 'Liga'
                      check (match_type in ('Liga', 'Torneio', 'Scrim', 'Final')),
  player_stats      jsonb not null default '[]',
  fans_delta        integer not null default 0,
  budget_delta      integer not null default 0,
  played_at         timestamptz,
  created_at        timestamptz not null default now()
);

alter table matches enable row level security;

-- Usuário vê partidas do próprio time
create policy "Users can view their own matches"
  on matches for select
  to authenticated
  using (team_id in (select id from teams where user_id = auth.uid()));

-- Usuário pode atualizar partidas do próprio time (para resolver resultado)
create policy "Users can update their own matches"
  on matches for update
  to authenticated
  using (team_id in (select id from teams where user_id = auth.uid()));

create index matches_team_scheduled_idx on matches (team_id, scheduled_for desc);
create index matches_team_status_idx    on matches (team_id, status);
