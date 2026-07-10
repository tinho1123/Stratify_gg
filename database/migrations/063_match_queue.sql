-- Migration 063: Fila de matchmaking da Liga
-- Run this AFTER migration 062
--
-- generate_next_match() (reescrita na migration 066) passa a tentar parear dois times reais da
-- mesma faixa de tier numa única fixture, em vez de só anotar um snapshot de um time real. Quem
-- não pareia na hora entra aqui e fica disponível pro job de matchmaking (migration 065/067)
-- tentar parear antes do kickoff; quem não parear a tempo simplesmente vira partida vs bot no
-- kickoff (fallback já existente).

create table if not exists match_queue (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null unique references teams(id) on delete cascade,
  tier             text not null,
  pdl_snapshot     integer not null,
  desired_kickoff  timestamptz not null,
  status           text not null default 'waiting' check (status in ('waiting', 'matched', 'expired')),
  matched_match_id uuid references matches(id),
  queued_at        timestamptz not null default now()
);

alter table match_queue enable row level security;

create policy "Users can view their own queue entry"
  on match_queue for select
  to authenticated
  using (team_id in (select id from teams where user_id = auth.uid()));

-- Sem policy de insert/update/delete -> só generate_next_match() e
-- system_match_matchmaking_tick() (SECURITY DEFINER) escrevem aqui.

create index if not exists match_queue_lookup_idx on match_queue (tier, status, queued_at);
