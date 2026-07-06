-- Migration 018: Temporadas/liga por tier, com inscrição obrigatória
-- Run this AFTER migration 017
--
-- Cada tier (Bronze, Prata, Ouro, ...) roda sua própria liga/temporada, com janela de
-- tempo compartilhada entre todas as tiers (ciclo fixo de 14 dias). Um time só aparece na
-- classificação da temporada depois de se inscrever via `join_season()` — partidas jogadas
-- sem inscrição continuam valendo economia/pdl normalmente, mas não contam pontos de liga.
--
-- Os limites de PDL em `tier_for_pdl` precisam ficar em sincronia com `constants/tiers.ts`
-- no client.

create table if not exists seasons (
  id            uuid primary key default gen_random_uuid(),
  tier          text not null check (tier in
                  ('Bronze','Prata','Ouro','Platina','Diamante','Mestre','Grão-Mestre')),
  season_number integer not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  status        text not null default 'active' check (status in ('active', 'ended')),
  created_at    timestamptz not null default now(),
  unique (tier, season_number)
);

alter table seasons enable row level security;

create policy "Seasons are viewable by authenticated users"
  on seasons for select
  to authenticated
  using (true);

-- Sem policy de insert/update para `authenticated`: temporadas só são criadas/encerradas
-- pela função SECURITY DEFINER `get_or_create_season`.

create table if not exists season_standings (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references seasons(id) on delete cascade,
  team_id        uuid not null references teams(id) on delete cascade,
  team_name      text not null,          -- snapshot do nome do time (mesmo padrão de matches.opponent_name)
  points         integer not null default 0,
  wins           integer not null default 0,
  losses         integer not null default 0,
  matches_played integer not null default 0,
  joined_at      timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (season_id, team_id)
);

alter table season_standings enable row level security;

create policy "Standings are viewable by authenticated users"
  on season_standings for select
  to authenticated
  using (true);

-- Sem policy de insert/update/delete para `authenticated`: a linha só é criada por
-- `join_season()` e só é atualizada por `resolve_match()` (ambas SECURITY DEFINER).

create index if not exists season_standings_ranking_idx
  on season_standings (season_id, points desc, wins desc);
create index if not exists seasons_tier_status_idx
  on seasons (tier, status);

-- ── tier_for_pdl(): mesma tabela de limites do client (constants/tiers.ts) ──────────────────
create or replace function tier_for_pdl(p_pdl integer)
returns text
language sql
immutable
as $$
  select case
    when p_pdl >= 1800 then 'Grão-Mestre'
    when p_pdl >= 1500 then 'Mestre'
    when p_pdl >= 1200 then 'Diamante'
    when p_pdl >= 900  then 'Platina'
    when p_pdl >= 600  then 'Ouro'
    when p_pdl >= 300  then 'Prata'
    else 'Bronze'
  end;
$$;

-- ── get_or_create_season(): garante que existe uma temporada ativa para a tier informada ────
-- Janela fixa de 14 dias, alinhada ao epoch — todas as tiers trocam de temporada juntas.
-- Idempotente e sem impacto de segurança (só cria metadado), por isso pode ser chamada
-- diretamente pelo client.
create or replace function get_or_create_season(p_tier text)
returns seasons
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period        constant integer := 14 * 86400; -- 14 dias em segundos
  v_season_number integer;
  v_starts_at     timestamptz;
  v_ends_at       timestamptz;
  v_season        seasons%rowtype;
begin
  if p_tier not in ('Bronze','Prata','Ouro','Platina','Diamante','Mestre','Grão-Mestre') then
    raise exception 'invalid_tier';
  end if;

  v_season_number := floor(extract(epoch from now()) / v_period)::integer;
  v_starts_at := to_timestamp(v_season_number * v_period);
  v_ends_at   := v_starts_at + (v_period || ' seconds')::interval;

  -- Encerra (best-effort) temporadas dessa tier cujo prazo já passou
  update seasons set status = 'ended'
    where tier = p_tier and status = 'active' and ends_at <= now();

  insert into seasons (tier, season_number, starts_at, ends_at, status)
  values (p_tier, v_season_number, v_starts_at, v_ends_at, 'active')
  on conflict (tier, season_number) do nothing;

  select * into v_season from seasons
    where tier = p_tier and season_number = v_season_number;

  return v_season;
end;
$$;

grant execute on function get_or_create_season(text) to authenticated;

-- ── join_season(): time se inscreve na temporada da própria tier ────────────────────────────
-- Só pode entrar na temporada correspondente à tier atual do próprio time (via PDL), e só
-- enquanto ela estiver ativa. Idempotente (reentrar não duplica nem reseta pontos).
create or replace function join_season(p_season_id uuid)
returns season_standings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team   teams%rowtype;
  v_season seasons%rowtype;
  v_row    season_standings%rowtype;
begin
  select t.* into v_team from teams t where t.user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select s.* into v_season from seasons s where s.id = p_season_id;
  if not found then
    raise exception 'season_not_found';
  end if;

  if v_season.status <> 'active' or v_season.ends_at <= now() then
    raise exception 'season_ended';
  end if;

  if v_season.tier <> tier_for_pdl(v_team.pdl) then
    raise exception 'wrong_tier';
  end if;

  insert into season_standings (season_id, team_id, team_name)
  values (v_season.id, v_team.id, v_team.name)
  on conflict (season_id, team_id) do nothing;

  select * into v_row from season_standings
    where season_id = v_season.id and team_id = v_team.id;

  return v_row;
end;
$$;

grant execute on function join_season(uuid) to authenticated;

-- ── resolve_match(): agora também credita pontos de liga, mas só para quem já entrou ────────
-- Recria a função (mesma assinatura da migration 017) adicionando o bloco de temporada no
-- final. Se o time não tiver se inscrito na temporada da sua tier atual, o UPDATE abaixo
-- não afeta nenhuma linha e a partida simplesmente não conta para a classificação.
create or replace function resolve_match(p_match_id uuid, p_player_stats jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team         teams%rowtype;
  v_match        matches%rowtype;
  v_game_style   text;
  v_my_avg       numeric;
  v_my_form      numeric;
  v_bonus        numeric;
  v_eff          numeric;
  v_prob         numeric;
  v_won          boolean;
  v_score_own    integer;
  v_score_opp    integer;
  v_diff         numeric;
  v_pdl_delta    integer;
  v_fans_delta   integer;
  v_budget_delta integer;
  v_pre_tier     text;
  v_season       seasons%rowtype;
begin
  select t.* into v_team from teams t where t.user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select m.* into v_match from matches m
    where m.id = p_match_id and m.team_id = v_team.id
    for update;

  if not found then
    raise exception 'match_not_found';
  end if;

  if v_match.status <> 'scheduled' then
    raise exception 'match_not_scheduled';
  end if;

  if v_match.scheduled_for > now() then
    raise exception 'match_not_ready';
  end if;

  select coalesce(avg(rating), 65), coalesce(avg(form), 80)
    into v_my_avg, v_my_form
    from players where team_id = v_team.id;
  v_my_avg  := round(v_my_avg);
  v_my_form := round(v_my_form);

  select game_style into v_game_style from tactics where team_id = v_team.id;
  v_game_style := coalesce(v_game_style, 'adaptativo');

  v_bonus := case v_game_style
    when 'agressivo'  then 4
    when 'controlado' then 3
    else 0
  end;
  v_eff  := v_my_avg + (v_my_form / 100.0) * 8 + v_bonus;
  v_prob := greatest(0.12, least(0.88, 0.5 + (v_eff - v_match.opponent_rating) / 80.0));
  v_won  := random() < v_prob;

  v_score_own := case when v_won then 16 else 3 + floor(random() * 12)::int end;
  v_score_opp := case when v_won then 3 + floor(random() * 12)::int else 16 end;

  v_diff := v_match.opponent_rating - v_my_avg;
  v_pdl_delta := case
    when v_won then round(greatest(5, least(40, 20 + v_diff * 0.6)))
    else -round(greatest(5, least(30, 15 - v_diff * 0.6)))
  end;

  v_fans_delta   := case when v_won then 200 + floor(random() * 601)::int
                         else -(80 + floor(random() * 221)::int) end;
  v_budget_delta := case when v_won then 1000 + floor(random() * 4001)::int else 0 end;

  update matches set
    status       = 'played',
    result       = case when v_won then 'win' else 'loss' end,
    score_own    = v_score_own,
    score_opp    = v_score_opp,
    player_stats = p_player_stats,
    fans_delta   = v_fans_delta,
    budget_delta = v_budget_delta,
    pdl_delta    = v_pdl_delta,
    played_at    = now()
  where id = p_match_id;

  update teams set
    fans   = greatest(0, fans + v_fans_delta),
    budget = budget + v_budget_delta,
    wins   = wins   + case when v_won then 1 else 0 end,
    losses = losses + case when v_won then 0 else 1 end,
    pdl    = greatest(0, pdl + v_pdl_delta)
  where id = v_team.id;

  -- Liga: a partida conta pontos na tier em que o time estava ANTES do resultado (v_team.pdl
  -- ainda não tem o delta aplicado aqui), e só se o time já estiver inscrito nessa temporada.
  v_pre_tier := tier_for_pdl(v_team.pdl);
  v_season := get_or_create_season(v_pre_tier);

  update season_standings set
    team_name      = v_team.name,
    points         = points + case when v_won then 3 else 0 end,
    wins           = wins + case when v_won then 1 else 0 end,
    losses         = losses + case when v_won then 0 else 1 end,
    matches_played = matches_played + 1,
    updated_at     = now()
  where season_id = v_season.id and team_id = v_team.id;

  return jsonb_build_object(
    'won',          v_won,
    'score_own',    v_score_own,
    'score_opp',    v_score_opp,
    'fans_delta',   v_fans_delta,
    'budget_delta', v_budget_delta,
    'pdl_delta',    v_pdl_delta
  );
end;
$$;

grant execute on function resolve_match(uuid, jsonb) to authenticated;
