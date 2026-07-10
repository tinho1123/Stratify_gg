-- Migration 062: Schema do motor de partidas ao vivo (sessão + eventos)
-- Run this AFTER migration 061
--
-- Base do motor autônomo de partidas: as três fontes de partida existentes (matches/Liga,
-- tournament_matches/Torneio, team_challenges/Desafios) passam a compartilhar um novo status
-- 'live' e uma sessão comum (`match_live_state`) que guarda o roteiro determinístico inteiro
-- (calculado uma única vez no kickoff, por `system_kickoff_due_sessions`, migration 065) e o
-- progresso de revelação. `match_events` é o log que o client consome via Realtime — o client
-- nunca escreve em nenhuma das duas tabelas, só as funções `system_*` (SECURITY DEFINER,
-- chamadas pelo pg_cron) escrevem.
--
-- IMPORTANTE: as alterações em `matches` (que adicionam a coluna `fixture_id`) precisam rodar
-- ANTES de criar as policies de `match_live_state`/`match_events` abaixo, porque essas policies
-- referenciam `matches.fixture_id` diretamente — senão o `create policy` falha com "column
-- m.fixture_id does not exist".

-- ── Alterações em matches (Liga): status 'live' + pareamento real entre dois times reais ──────
alter table matches drop constraint if exists matches_status_check;
alter table matches add constraint matches_status_check
  check (status in ('scheduled', 'live', 'played', 'cancelled'));

-- fixture_id liga as duas linhas espelho (uma por time) de uma mesma partida pareada de verdade
-- — cada time continua enxergando só a própria linha (`team_id = seu time`), sem precisar de
-- nova policy de SELECT pro adversário. paired_match_id aponta pra linha espelho do outro lado;
-- is_placeholder_bot fica true enquanto a fila de matchmaking ainda não achou par (ver 066).
alter table matches add column if not exists fixture_id uuid not null default gen_random_uuid();
alter table matches add column if not exists paired_match_id uuid references matches(id);
alter table matches add column if not exists is_placeholder_bot boolean not null default false;
alter table matches add column if not exists queue_id uuid;

-- Dados legados: partidas 'scheduled' criadas antes deste deploy nunca tiveram pareamento real
-- (opponent_team_id sempre foi só um snapshot decorativo, nunca usado em resolve_match) — o
-- primeiro kickoff simplesmente as resolve como bot, comportamento idêntico ao atual. Nenhuma
-- precisa ser cancelada ou recriada.
update matches set is_placeholder_bot = true where status = 'scheduled';

-- ── Alterações em tournament_matches (Torneio): status 'live' ─────────────────────────────────
alter table tournament_matches drop constraint if exists tournament_matches_status_check;
alter table tournament_matches add constraint tournament_matches_status_check
  check (status in ('pending', 'ready', 'live', 'played'));

-- ── Alterações em team_challenges (Desafios): status 'live' ───────────────────────────────────
alter table team_challenges drop constraint if exists team_challenges_status_check;
alter table team_challenges add constraint team_challenges_status_check
  check (status in ('pending', 'accepted', 'declined', 'expired', 'live', 'played'));

-- ── match_live_state: uma linha por sessão ao vivo/finalizada, polimórfica sobre as 3 fontes ──
create table if not exists match_live_state (
  id                      uuid primary key default gen_random_uuid(),
  match_source            text not null check (match_source in ('league', 'tournament', 'challenge')),
  match_id                uuid not null,
  status                  text not null default 'scheduled'
                            check (status in ('scheduled', 'live', 'finalizing', 'played')),
  resolution_script       jsonb not null default '[]'::jsonb, -- roteiro completo, calculado 1x no kickoff
  roster_a                jsonb not null default '[]'::jsonb, -- elenco congelado no kickoff
  roster_b                jsonb not null default '[]'::jsonb,
  eff_a                   numeric, -- força efetiva de cada lado no momento do kickoff (congelada
  eff_b                   numeric, -- junto com o roteiro, pra system_finalize_matches calcular
                                    -- deltas de economia sem precisar recalcular nada depois)
  total_rounds            integer not null default 0,
  revealed_rounds         integer not null default 0,
  reveal_interval_seconds integer not null default 113, -- ~1800s / 16 rounds (mínimo possível)
  next_reveal_at          timestamptz,
  kickoff_at              timestamptz,
  finalized_at            timestamptz,
  created_at              timestamptz not null default now(),
  unique (match_source, match_id)
);

alter table match_live_state enable row level security;

-- "Participante" depende da fonte: cada uma tem seu próprio jeito de identificar os dois lados.
-- Pra 'league' o match_id guardado aqui é `matches.fixture_id` (chave compartilhada pelas duas
-- linhas espelho de uma partida pareada), não `matches.id` — por isso o join é por fixture_id.
create policy "Participants can view their match live state"
  on match_live_state for select
  to authenticated
  using (
    (match_source = 'league' and exists (
      select 1 from matches m where m.fixture_id = match_live_state.match_id
        and m.team_id in (select id from teams where user_id = auth.uid())
    ))
    or (match_source = 'tournament' and exists (
      select 1 from tournament_matches tm where tm.id = match_live_state.match_id
        and (tm.team_a_id in (select id from teams where user_id = auth.uid())
          or tm.team_b_id in (select id from teams where user_id = auth.uid()))
    ))
    or (match_source = 'challenge' and exists (
      select 1 from team_challenges tc where tc.id = match_live_state.match_id
        and (tc.challenger_team_id in (select id from teams where user_id = auth.uid())
          or tc.opponent_team_id in (select id from teams where user_id = auth.uid()))
    ))
  );

-- Sem policy de insert/update/delete -> só as funções SECURITY DEFINER (migration 065) escrevem.

create index if not exists match_live_state_status_idx on match_live_state (status, next_reveal_at);

-- ── match_events: log consumido via Realtime pelo client (uma tabela pras 3 fontes) ──────────
create table if not exists match_events (
  id           uuid primary key default gen_random_uuid(),
  match_source text not null check (match_source in ('league', 'tournament', 'challenge')),
  match_id     uuid not null,
  round        integer not null,
  seq          integer not null,
  event_type   text not null check (event_type in ('round_start', 'kill', 'util', 'round_end', 'match_end')),
  payload      jsonb not null default '{}'::jsonb,
  revealed_at  timestamptz not null default now(),
  unique (match_source, match_id, round, seq)
);

alter table match_events enable row level security;

-- Mesma ressalva da policy acima: pra 'league' o match_id aqui é `matches.fixture_id`.
create policy "Participants can view their match events"
  on match_events for select
  to authenticated
  using (
    (match_source = 'league' and exists (
      select 1 from matches m where m.fixture_id = match_events.match_id
        and m.team_id in (select id from teams where user_id = auth.uid())
    ))
    or (match_source = 'tournament' and exists (
      select 1 from tournament_matches tm where tm.id = match_events.match_id
        and (tm.team_a_id in (select id from teams where user_id = auth.uid())
          or tm.team_b_id in (select id from teams where user_id = auth.uid()))
    ))
    or (match_source = 'challenge' and exists (
      select 1 from team_challenges tc where tc.id = match_events.match_id
        and (tc.challenger_team_id in (select id from teams where user_id = auth.uid())
          or tc.opponent_team_id in (select id from teams where user_id = auth.uid()))
    ))
  );

-- Sem policy de insert/update/delete -> só as funções SECURITY DEFINER escrevem. É esse insert
-- que dispara Realtime pro espectador (mesmo mecanismo de chat_messages/dm_messages/auctions).
create index if not exists match_events_lookup_idx on match_events (match_source, match_id, round, seq);

alter publication supabase_realtime add table match_events;
