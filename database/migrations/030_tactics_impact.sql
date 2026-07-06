-- Migration 030: Escalação tática e estratégia de economia passam a afetar a partida
-- Run this AFTER migration 029
--
-- A tela de Táticas salva `eco_strategy` e `role_assignments` (a escalação por função, com o
-- indicador "FIT"/"FORA DA POSIÇÃO" de cada jogador), mas só `game_style` era usado em
-- `resolve_match` — escalar todo o time fora da posição não mudava nada no resultado.
--
-- Agora: cada jogador escalado numa função diferente da sua natural (`role_assignments` vs
-- `players.role`) aplica uma penalidade fixa na força efetiva do time; e `eco_strategy` dá um
-- pequeno bônus, no mesmo espírito do que `game_style` já fazia.

create or replace function resolve_match(p_match_id uuid, p_player_stats jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team                 teams%rowtype;
  v_match                matches%rowtype;
  v_game_style            text;
  v_eco_strategy           text;
  v_role_assignments        jsonb;
  v_out_of_position          integer;
  v_my_avg                    numeric;
  v_my_form                    numeric;
  v_bonus                       numeric;
  v_eco_bonus                    numeric;
  v_eff                           numeric;
  v_prob                          numeric;
  v_won                          boolean;
  v_score_own                     integer;
  v_score_opp                      integer;
  v_diff                            numeric;
  v_pdl_delta                        integer;
  v_fans_delta                        integer;
  v_budget_delta                       integer;
  v_pre_tier                            text;
  v_season                               seasons%rowtype;
  v_match_energy_cost constant integer := 15;
  v_morale_delta         integer;
  v_injury_roll           numeric;
  v_injured_id             uuid;
  v_injured_name           text;
  v_injury_days             integer;
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

  -- Jogadores lesionados não contam pra força do time.
  select coalesce(avg(rating), 65), coalesce(avg(form), 80)
    into v_my_avg, v_my_form
    from players where team_id = v_team.id and status = 'online';
  v_my_avg  := round(v_my_avg);
  v_my_form := round(v_my_form);

  select game_style, eco_strategy, role_assignments
    into v_game_style, v_eco_strategy, v_role_assignments
    from tactics where team_id = v_team.id;
  v_game_style := coalesce(v_game_style, 'adaptativo');
  v_eco_strategy := coalesce(v_eco_strategy, 'balanceado');
  v_role_assignments := coalesce(v_role_assignments, '{}'::jsonb);

  -- Quantos jogadores online estão escalados fora da função natural.
  select count(*) into v_out_of_position
    from players p
    where p.team_id = v_team.id
      and p.status = 'online'
      and v_role_assignments ? p.id::text
      and (v_role_assignments ->> p.id::text) <> p.role;

  v_bonus := case v_game_style
    when 'agressivo'  then 4
    when 'controlado' then 3
    else 0
  end;
  v_eco_bonus := case v_eco_strategy
    when 'full_buy'  then 3
    when 'economico' then 1
    else 0
  end;

  v_eff  := v_my_avg + (v_my_form / 100.0) * 8 + v_bonus + v_eco_bonus - (v_out_of_position * 3);
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

  -- Moral: vitória anima o elenco, derrota derruba.
  v_morale_delta := 5 + floor(random() * 6)::int; -- 5-10
  update players
    set morale = case when v_won
      then least(100, morale + v_morale_delta)
      else greatest(0, morale - v_morale_delta)
    end
    where team_id = v_team.id;

  -- Lesão: ~8% de chance por partida, sorteando entre quem está disponível.
  v_injury_roll := random();
  if v_injury_roll < 0.08 then
    select id, name into v_injured_id, v_injured_name
      from players
      where team_id = v_team.id and status = 'online'
      order by random()
      limit 1;

    if v_injured_id is not null then
      v_injury_days := 1 + floor(random() * 3)::int; -- 1-3 dias
      update players set
        status         = 'injured',
        injury_ends_at = now() + (v_injury_days || ' days')::interval
      where id = v_injured_id;

      insert into notifications (user_id, type, tag, message)
      values (
        auth.uid(), 'alert', 'LESÃO',
        v_injured_name || ' se lesionou na partida — fora por ' || v_injury_days || ' dia(s).'
      );
    end if;
  end if;

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
