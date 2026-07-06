-- Migration 028: Jogar partida também consome energia do elenco
-- Run this AFTER migration 027
--
-- Até agora só o treino gastava energia — jogar uma partida não custava nada, o que não faz
-- muito sentido (partida cansa tanto quanto treino). Recria `resolve_match` (mesma assinatura
-- de 017/018) adicionando: regenera energia do time (mesma função de 027, pra não descontar
-- em cima de um valor desatualizado) e desconta um custo fixo do elenco inteiro, sem deixar
-- ficar negativo.

create or replace function resolve_match(p_match_id uuid, p_player_stats jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team              teams%rowtype;
  v_match             matches%rowtype;
  v_game_style        text;
  v_my_avg            numeric;
  v_my_form           numeric;
  v_bonus             numeric;
  v_eff                numeric;
  v_prob               numeric;
  v_won                boolean;
  v_score_own          integer;
  v_score_opp          integer;
  v_diff                numeric;
  v_pdl_delta           integer;
  v_fans_delta          integer;
  v_budget_delta        integer;
  v_pre_tier            text;
  v_season              seasons%rowtype;
  v_match_energy_cost constant integer := 15;
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

  -- Regenera antes de descontar, pra não gastar em cima de um valor desatualizado.
  perform regen_energy_for_team(v_team.id);
  update players
    set energy = greatest(0, energy - v_match_energy_cost)
    where team_id = v_team.id;

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
