-- Migration 035: Torneios especiais (chaveamento eliminatório entre times reais do mesmo elo)
-- Run this AFTER migration 034
--
-- Evento paralelo à liga: 8 times do mesmo elo se inscrevem numa janela de 4 dias; ao encher,
-- o chaveamento é sorteado e resolvido em 3 rodadas eliminatórias (quartas/semi/final) dentro do
-- mesmo ciclo de 14 dias das temporadas. Se não encher a tempo, o torneio é cancelado — os
-- adversários são sempre outros times reais (nunca bot), então sem 8 inscritos não há chave.
--
-- Diferente do sistema de partidas normais (que resolve o resultado de forma independente por
-- time, comparando contra um "snapshot" do rating do adversário), aqui os dois lados são times
-- reais e o resultado precisa ser o MESMO pros dois — por isso `resolve_tournament_match` é
-- idempotente e pode ser chamado por qualquer um dos dois donos de time: quem chamar primeiro
-- decide o resultado (com o rating ao vivo dos dois lados), o segundo só lê de volta.

create table if not exists tournaments (
  id                   uuid primary key default gen_random_uuid(),
  tier                 text not null check (tier in
                         ('Bronze','Prata','Ouro','Platina','Diamante','Mestre','Grão-Mestre')),
  cycle_number         integer not null,
  status               text not null default 'registering'
                         check (status in ('registering','active','completed','cancelled')),
  bracket_size         integer not null default 8,
  registration_ends_at timestamptz not null,
  ends_at              timestamptz not null,
  created_at           timestamptz not null default now(),
  unique (tier, cycle_number)
);

alter table tournaments enable row level security;

create policy "Tournaments are viewable by authenticated users"
  on tournaments for select
  to authenticated
  using (true);

-- Sem policy de insert/update pra authenticated -> só as funções SECURITY DEFINER abaixo.

create table if not exists tournament_entries (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  team_id       uuid not null references teams(id) on delete cascade,
  team_name     text not null,
  joined_at     timestamptz not null default now(),
  primary key (tournament_id, team_id)
);

alter table tournament_entries enable row level security;

create policy "Entries are viewable by authenticated users"
  on tournament_entries for select
  to authenticated
  using (true);

create table if not exists tournament_matches (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments(id) on delete cascade,
  round          integer not null,
  slot           integer not null,
  team_a_id      uuid references teams(id),
  team_b_id      uuid references teams(id),
  team_a_name    text,
  team_b_name    text,
  status         text not null default 'pending'
                   check (status in ('pending','ready','played')),
  scheduled_for  timestamptz,
  score_a        integer,
  score_b        integer,
  winner_team_id uuid references teams(id),
  played_at      timestamptz,
  unique (tournament_id, round, slot)
);

alter table tournament_matches enable row level security;

create policy "Tournament matches are viewable by authenticated users"
  on tournament_matches for select
  to authenticated
  using (true);

create index if not exists tournament_matches_tournament_idx
  on tournament_matches (tournament_id, round, slot);

-- ── get_or_create_tournament(): janela de inscrição de 4 dias dentro do ciclo de 14 dias ────
-- Mesmo epoch/ciclo das temporadas (018_create_seasons.sql), só que com uma sub-janela de
-- inscrição mais curta. Idempotente e sem impacto de segurança — pode ser chamada direto pelo
-- client, igual `get_or_create_season`.
create or replace function get_or_create_tournament(p_tier text)
returns tournaments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period      constant integer := 14 * 86400;
  v_reg_window  constant integer := 4 * 86400;
  v_cycle       integer;
  v_starts_at   timestamptz;
  v_reg_ends_at timestamptz;
  v_ends_at     timestamptz;
  v_tournament  tournaments%rowtype;
begin
  if p_tier not in ('Bronze','Prata','Ouro','Platina','Diamante','Mestre','Grão-Mestre') then
    raise exception 'invalid_tier';
  end if;

  v_cycle := floor(extract(epoch from now()) / v_period)::integer;
  v_starts_at   := to_timestamp(v_cycle * v_period);
  v_reg_ends_at := v_starts_at + (v_reg_window || ' seconds')::interval;
  v_ends_at     := v_starts_at + (v_period || ' seconds')::interval;

  -- Cancela (best-effort) torneios dessa tier cuja inscrição fechou sem encher a chave.
  update tournaments set status = 'cancelled'
    where tier = p_tier and status = 'registering' and registration_ends_at <= now();

  insert into tournaments (tier, cycle_number, registration_ends_at, ends_at)
  values (p_tier, v_cycle, v_reg_ends_at, v_ends_at)
  on conflict (tier, cycle_number) do nothing;

  select * into v_tournament from tournaments where tier = p_tier and cycle_number = v_cycle;
  return v_tournament;
end;
$$;

grant execute on function get_or_create_tournament(text) to authenticated;

-- ── generate_tournament_bracket(): sorteia o chaveamento quando a chave enche ───────────────
-- Só é chamada internamente por `join_tournament` — não é exposta pro client (Postgres libera
-- EXECUTE pra PUBLIC por padrão em toda função nova, por isso o revoke explícito no final).
create or replace function generate_tournament_bracket(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament      tournaments%rowtype;
  v_total_rounds    integer;
  v_entries         uuid[];
  v_names           text[];
  v_i               integer;
  v_round           integer;
  v_matches_in_round integer;
begin
  select * into v_tournament from tournaments where id = p_tournament_id;
  if not found then
    raise exception 'tournament_not_found';
  end if;

  v_total_rounds := round(log(2, v_tournament.bracket_size))::integer;

  -- Embaralha as inscrições (mesma coluna aleatória usada nos dois array_agg, senão os dois
  -- arrays podem sair em ordens diferentes e desparear time/nome).
  select array_agg(team_id order by r), array_agg(team_name order by r)
    into v_entries, v_names
    from (
      select team_id, team_name, random() as r
      from tournament_entries where tournament_id = p_tournament_id
    ) shuffled;

  -- Rodada 1: pareia os times embaralhados dois a dois (arrays em SQL são 1-indexados).
  for v_i in 0 .. (v_tournament.bracket_size / 2 - 1) loop
    insert into tournament_matches
      (tournament_id, round, slot, team_a_id, team_b_id, team_a_name, team_b_name, status, scheduled_for)
    values (
      p_tournament_id, 1, v_i,
      v_entries[v_i * 2 + 1], v_entries[v_i * 2 + 2],
      v_names[v_i * 2 + 1],   v_names[v_i * 2 + 2],
      'ready', now() + interval '1 day'
    );
  end loop;

  -- Rodadas seguintes: placeholders vazios, preenchidos conforme os vencedores avançam.
  for v_round in 2 .. v_total_rounds loop
    v_matches_in_round := v_tournament.bracket_size / (2 ^ v_round)::integer;
    for v_i in 0 .. (v_matches_in_round - 1) loop
      insert into tournament_matches (tournament_id, round, slot, status)
      values (p_tournament_id, v_round, v_i, 'pending');
    end loop;
  end loop;

  update tournaments set status = 'active' where id = p_tournament_id;
end;
$$;

revoke execute on function generate_tournament_bracket(uuid) from public, authenticated, anon;

-- ── join_tournament(): time se inscreve; dispara o sorteio do chaveamento ao encher a chave ─
create or replace function join_tournament(p_tournament_id uuid)
returns tournament_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team       teams%rowtype;
  v_tournament tournaments%rowtype;
  v_count      integer;
  v_row        tournament_entries%rowtype;
begin
  select t.* into v_team from teams t where t.user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select * into v_tournament from tournaments where id = p_tournament_id for update;
  if not found then
    raise exception 'tournament_not_found';
  end if;

  if v_tournament.status <> 'registering' or v_tournament.registration_ends_at <= now() then
    raise exception 'registration_closed';
  end if;

  if v_tournament.tier <> tier_for_pdl(v_team.pdl) then
    raise exception 'wrong_tier';
  end if;

  select count(*) into v_count from tournament_entries where tournament_id = p_tournament_id;
  if v_count >= v_tournament.bracket_size then
    raise exception 'tournament_full';
  end if;

  insert into tournament_entries (tournament_id, team_id, team_name)
  values (p_tournament_id, v_team.id, v_team.name)
  on conflict (tournament_id, team_id) do nothing;

  select count(*) into v_count from tournament_entries where tournament_id = p_tournament_id;
  if v_count = v_tournament.bracket_size then
    perform generate_tournament_bracket(p_tournament_id);
  end if;

  select * into v_row from tournament_entries
    where tournament_id = p_tournament_id and team_id = v_team.id;
  return v_row;
end;
$$;

grant execute on function join_tournament(uuid) to authenticated;

-- ── resolve_tournament_match(): idempotente, chamável por qualquer um dos dois lados ───────
create or replace function resolve_tournament_match(p_match_id uuid)
returns tournament_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match        tournament_matches%rowtype;
  v_team_id      uuid;
  v_a_avg        numeric;
  v_b_avg        numeric;
  v_prob         numeric;
  v_a_won        boolean;
  v_score_a      integer;
  v_score_b      integer;
  v_winner       uuid;
  v_loser        uuid;
  v_tournament   tournaments%rowtype;
  v_total_rounds integer;
  v_next_round   integer;
  v_next_slot    integer;
begin
  select id into v_team_id from teams where user_id = auth.uid();
  if v_team_id is null then
    raise exception 'team_not_found';
  end if;

  select * into v_match from tournament_matches where id = p_match_id for update;
  if not found then
    raise exception 'match_not_found';
  end if;

  if v_team_id not in (v_match.team_a_id, v_match.team_b_id) then
    raise exception 'not_your_match';
  end if;

  -- Idempotente: se o outro lado já resolveu, só devolve o que já foi decidido.
  if v_match.status = 'played' then
    return v_match;
  end if;

  if v_match.status <> 'ready' then
    raise exception 'match_not_ready';
  end if;

  if v_match.scheduled_for > now() then
    raise exception 'match_not_ready';
  end if;

  select coalesce(avg(rating), 65) into v_a_avg from players where team_id = v_match.team_a_id and status = 'online';
  select coalesce(avg(rating), 65) into v_b_avg from players where team_id = v_match.team_b_id and status = 'online';

  v_prob := greatest(0.12, least(0.88, 0.5 + (v_a_avg - v_b_avg) / 80.0));
  v_a_won := random() < v_prob;

  v_score_a := case when v_a_won then 16 else 3 + floor(random() * 12)::int end;
  v_score_b := case when v_a_won then 3 + floor(random() * 12)::int else 16 end;
  v_winner  := case when v_a_won then v_match.team_a_id else v_match.team_b_id end;
  v_loser   := case when v_a_won then v_match.team_b_id else v_match.team_a_id end;

  update tournament_matches set
    status = 'played', score_a = v_score_a, score_b = v_score_b,
    winner_team_id = v_winner, played_at = now()
  where id = p_match_id;

  select * into v_tournament from tournaments where id = v_match.tournament_id;
  v_total_rounds := round(log(2, v_tournament.bracket_size))::integer;

  if v_match.round < v_total_rounds then
    v_next_round := v_match.round + 1;
    v_next_slot  := v_match.slot / 2;

    if v_match.slot % 2 = 0 then
      update tournament_matches set
        team_a_id = v_winner, team_a_name = (select name from teams where id = v_winner)
        where tournament_id = v_match.tournament_id and round = v_next_round and slot = v_next_slot;
    else
      update tournament_matches set
        team_b_id = v_winner, team_b_name = (select name from teams where id = v_winner)
        where tournament_id = v_match.tournament_id and round = v_next_round and slot = v_next_slot;
    end if;

    -- Se os dois lados da próxima rodada já estiverem definidos, libera a partida.
    update tournament_matches set
      status = 'ready', scheduled_for = now() + interval '1 day'
      where tournament_id = v_match.tournament_id and round = v_next_round and slot = v_next_slot
        and team_a_id is not null and team_b_id is not null and status = 'pending';
  else
    -- Era a final: premia campeão e vice, encerra o torneio.
    update teams set
      budget = budget + 5000, fans = fans + 1000, pdl = pdl + 40, premium_credits = premium_credits + 300
      where id = v_winner;
    update teams set
      budget = budget + 2000, fans = fans + 400, pdl = pdl + 15
      where id = v_loser;

    update tournaments set status = 'completed' where id = v_match.tournament_id;
  end if;

  select * into v_match from tournament_matches where id = p_match_id;
  return v_match;
end;
$$;

grant execute on function resolve_tournament_match(uuid) to authenticated;
