-- Migration 065: Funções do motor de partidas (matchmaking, kickoff, reveal, finalize)
-- Run this AFTER migration 064
--
-- Todas as funções `system_*` são chamadas exclusivamente pelo pg_cron (migration 067), nunca
-- pelo client — `revoke execute ... from public, authenticated, anon` logo após cada definição,
-- mesmo padrão de `generate_tournament_bracket`/`redeem_iap_purchase`. Elas iteram TODAS as
-- partidas devidas de TODOS os usuários (não só as do chamador), porque quem chama é o role de
-- sistema do pg_cron (postgres), não um usuário autenticado via auth.uid().
--
-- `resolve_match`/`resolve_tournament_match`/`resolve_challenge_match` (as RPCs antigas,
-- client-triggered) ficam com EXECUTE revogado de `authenticated` no fim deste arquivo: a partir
-- de agora a única forma de uma partida ser resolvida é pelo motor autônomo. Isso também fecha
-- uma janela de corrida: sem o revoke, um client rápido poderia resolver a partida no modelo
-- antigo (instantâneo, sem simulação ao vivo) antes do cron fazer o kickoff.

-- ── generate_bot_roster(): elenco fictício de 5 jogadores pro fallback vs bot ──────────────────
create or replace function generate_bot_roster()
returns jsonb
language plpgsql
as $$
declare
  v_roles  text[] := array['IGL', 'AWPer', 'Support', 'Entry', 'Flex'];
  v_prefix text[] := array['z', 'x', 'v', 'k', 'n', 's', 'd', 'r', 't'];
  v_word   text[] := array[
    'blade', 'wolf', 'nova', 'frost', 'raven', 'storm', 'ghost', 'viper',
    'cipher', 'echo', 'reaper', 'shadow', 'phantom', 'blaze', 'hawk', 'spike'
  ];
  v_roster jsonb := '[]'::jsonb;
  v_i      integer;
  v_name   text;
begin
  for v_i in 1 .. 5 loop
    v_name := v_prefix[1 + floor(random() * array_length(v_prefix, 1))::int]
      || initcap(v_word[1 + floor(random() * array_length(v_word, 1))::int]);
    v_roster := v_roster || jsonb_build_array(jsonb_build_object(
      'id', 'bot-' || v_i, 'name', v_name, 'role', v_roles[v_i]
    ));
  end loop;
  return v_roster;
end;
$$;

revoke execute on function generate_bot_roster() from public, authenticated, anon;

-- ── league_effective_rating(): mesma fórmula de força efetiva que resolve_match já usava ──────
-- (rating+form médios dos jogadores online + bônus de game_style/eco_strategy - penalidade de
-- escalação fora de posição), só que reutilizável pros dois lados de uma partida de Liga real.
create or replace function league_effective_rating(p_team_id uuid)
returns numeric
language plpgsql
as $$
declare
  v_avg               numeric;
  v_form              numeric;
  v_game_style        text;
  v_eco_strategy      text;
  v_role_assignments  jsonb;
  v_out_of_position   integer;
  v_bonus             numeric;
  v_eco_bonus         numeric;
begin
  select coalesce(avg(rating), 65), coalesce(avg(form), 80) into v_avg, v_form
    from players where team_id = p_team_id and status = 'online';
  v_avg  := round(v_avg);
  v_form := round(v_form);

  select game_style, eco_strategy, role_assignments into v_game_style, v_eco_strategy, v_role_assignments
    from tactics where team_id = p_team_id;
  v_game_style       := coalesce(v_game_style, 'adaptativo');
  v_eco_strategy     := coalesce(v_eco_strategy, 'balanceado');
  v_role_assignments := coalesce(v_role_assignments, '{}'::jsonb);

  select count(*) into v_out_of_position
    from players p
    where p.team_id = p_team_id
      and p.status = 'online'
      and v_role_assignments ? p.id::text
      and (v_role_assignments ->> p.id::text) <> p.role;

  v_bonus     := case v_game_style when 'agressivo' then 4 when 'controlado' then 3 else 0 end;
  v_eco_bonus := case v_eco_strategy when 'full_buy' then 3 when 'economico' then 1 else 0 end;

  return v_avg + (v_form / 100.0) * 8 + v_bonus + v_eco_bonus - (v_out_of_position * 3);
end;
$$;

revoke execute on function league_effective_rating(uuid) from public, authenticated, anon;

-- ── generate_match_resolution_script(): roteiro determinístico completo, calculado 1x ──────────
-- Regulação: até 30 rounds, primeiro a 16 vence. Se chegar a 15-15 (única forma de sair da
-- regulação sem ninguém ter fechado em 16), entra em prorrogação: continua round a round até um
-- lado abrir 3 de vantagem, sem limite superior de rounds. `v_safety_cap` é só uma válvula de
-- segurança contra um bug de lógica virar loop infinito — não é regra de jogo (a probabilidade
-- de uma caminhada aleatória não fechar 3 de margem em 500 rounds é desprezível pra qualquer
-- v_prob dentro dos limites 0.12-0.88 usados aqui).
create or replace function generate_match_resolution_script(
  p_roster_a jsonb,
  p_roster_b jsonb,
  p_a_eff    numeric,
  p_b_eff    numeric
)
returns jsonb
language plpgsql
as $$
declare
  v_prob           numeric;
  v_round          integer := 0;
  v_score_a        integer := 0;
  v_score_b        integer := 0;
  v_a_won_round    boolean;
  v_overtime       boolean;
  v_rounds         jsonb := '[]'::jsonb;
  v_events         jsonb;
  v_round_obj      jsonb;
  v_losing_roster  jsonb;
  v_winning_roster jsonb;
  v_losing_size    integer;
  v_winning_size   integer;
  v_j              integer;
  v_victim         jsonb;
  v_killer         jsonb;
  v_safety_cap     constant integer := 500;
begin
  v_prob := greatest(0.12, least(0.88, 0.5 + (p_a_eff - p_b_eff) / 80.0));

  while v_round < 30 and v_score_a < 16 and v_score_b < 16 and v_round < v_safety_cap loop
    v_round := v_round + 1;
    v_a_won_round := random() < v_prob;
    v_overtime := false;

    if v_a_won_round then
      v_score_a := v_score_a + 1;
      v_losing_roster := p_roster_b; v_winning_roster := p_roster_a;
    else
      v_score_b := v_score_b + 1;
      v_losing_roster := p_roster_a; v_winning_roster := p_roster_b;
    end if;

    v_losing_size  := greatest(1, jsonb_array_length(v_losing_roster));
    v_winning_size := greatest(1, jsonb_array_length(v_winning_roster));
    v_events := '[]'::jsonb;
    for v_j in 0 .. (v_losing_size - 1) loop
      v_victim := v_losing_roster -> v_j;
      v_killer := v_winning_roster -> (floor(random() * v_winning_size)::int);
      v_events := v_events || jsonb_build_array(jsonb_build_object(
        'type', 'kill',
        'killer_side', case when v_a_won_round then 'a' else 'b' end,
        'killer_id',   v_killer ->> 'id',
        'killer_name', v_killer ->> 'name',
        'victim_side', case when v_a_won_round then 'b' else 'a' end,
        'victim_id',   v_victim ->> 'id',
        'victim_name', v_victim ->> 'name'
      ));
    end loop;

    v_round_obj := jsonb_build_object(
      'round', v_round, 'winner', case when v_a_won_round then 'a' else 'b' end,
      'score_a', v_score_a, 'score_b', v_score_b, 'overtime', v_overtime, 'events', v_events
    );
    v_rounds := v_rounds || jsonb_build_array(v_round_obj);
  end loop;

  -- Prorrogação: só chega aqui se empatou 15-15 na regulação.
  if v_score_a < 16 and v_score_b < 16 then
    while abs(v_score_a - v_score_b) < 3 and v_round < v_safety_cap loop
      v_round := v_round + 1;
      v_a_won_round := random() < v_prob;
      v_overtime := true;

      if v_a_won_round then
        v_score_a := v_score_a + 1;
        v_losing_roster := p_roster_b; v_winning_roster := p_roster_a;
      else
        v_score_b := v_score_b + 1;
        v_losing_roster := p_roster_a; v_winning_roster := p_roster_b;
      end if;

      v_losing_size  := greatest(1, jsonb_array_length(v_losing_roster));
      v_winning_size := greatest(1, jsonb_array_length(v_winning_roster));
      v_events := '[]'::jsonb;
      for v_j in 0 .. (v_losing_size - 1) loop
        v_victim := v_losing_roster -> v_j;
        v_killer := v_winning_roster -> (floor(random() * v_winning_size)::int);
        v_events := v_events || jsonb_build_array(jsonb_build_object(
          'type', 'kill',
          'killer_side', case when v_a_won_round then 'a' else 'b' end,
          'killer_id',   v_killer ->> 'id',
          'killer_name', v_killer ->> 'name',
          'victim_side', case when v_a_won_round then 'b' else 'a' end,
          'victim_id',   v_victim ->> 'id',
          'victim_name', v_victim ->> 'name'
        ));
      end loop;

      v_round_obj := jsonb_build_object(
        'round', v_round, 'winner', case when v_a_won_round then 'a' else 'b' end,
        'score_a', v_score_a, 'score_b', v_score_b, 'overtime', v_overtime, 'events', v_events
      );
      v_rounds := v_rounds || jsonb_build_array(v_round_obj);
    end loop;
  end if;

  return jsonb_build_object(
    'final_score_a', v_score_a,
    'final_score_b', v_score_b,
    'a_won',         v_score_a > v_score_b,
    'total_rounds',  v_round,
    'rounds',        v_rounds
  );
end;
$$;

revoke execute on function generate_match_resolution_script(jsonb, jsonb, numeric, numeric) from public, authenticated, anon;

-- ── system_match_matchmaking_tick(): pareia a fila da Liga antes do kickoff ────────────────────
create or replace function system_match_matchmaking_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a match_queue%rowtype;
  v_b match_queue%rowtype;
  v_match_a matches%rowtype;
  v_match_b matches%rowtype;
  v_fixture uuid;
  v_scheduled_for timestamptz;
begin
  -- Expira quem já passou do horário desejado sem par -> vira bot no kickoff mesmo assim
  -- (a linha placeholder já existe desde generate_next_match, então não precisa criar nada).
  update match_queue set status = 'expired'
    where status = 'waiting' and desired_kickoff <= now();

  for v_a in
    select * from match_queue where status = 'waiting' order by queued_at for update skip locked
  loop
    select * into v_b from match_queue
      where status = 'waiting' and tier = v_a.tier and team_id <> v_a.team_id
      order by queued_at
      for update skip locked
      limit 1;

    if v_b.id is null then
      continue;
    end if;

    select * into v_match_a from matches where queue_id = v_a.id;
    select * into v_match_b from matches where queue_id = v_b.id;
    if v_match_a.id is null or v_match_b.id is null then
      continue; -- linha placeholder ainda não existe (corrida improvável) -> tenta no próximo tick
    end if;

    v_fixture := v_match_a.fixture_id;
    -- As duas linhas foram criadas independentemente (cada time calculou seu próprio slot antes
    -- de entrar na fila) -> sincroniza pro horário mais cedo dos dois, senão o kickoff (que só
    -- olha `scheduled_for <= now()`) poderia considerar só um dos dois lados "devido" por vez.
    v_scheduled_for := least(v_match_a.scheduled_for, v_match_b.scheduled_for);

    update matches set
      opponent_team_id   = v_match_b.team_id,
      opponent_name      = (select name from teams where id = v_match_b.team_id),
      opponent_rating    = round(league_effective_rating(v_match_b.team_id))::integer,
      fixture_id         = v_fixture,
      paired_match_id    = v_match_b.id,
      scheduled_for       = v_scheduled_for,
      is_bot              = false,
      is_placeholder_bot  = false
      where id = v_match_a.id;

    update matches set
      opponent_team_id   = v_match_a.team_id,
      opponent_name      = (select name from teams where id = v_match_a.team_id),
      opponent_rating    = round(league_effective_rating(v_match_a.team_id))::integer,
      fixture_id         = v_fixture,
      paired_match_id    = v_match_a.id,
      scheduled_for       = v_scheduled_for,
      is_bot              = false,
      is_placeholder_bot  = false
      where id = v_match_b.id;

    update match_queue set status = 'matched', matched_match_id = v_match_a.id where id = v_a.id;
    update match_queue set status = 'matched', matched_match_id = v_match_b.id where id = v_b.id;
  end loop;
end;
$$;

revoke execute on function system_match_matchmaking_tick() from public, authenticated, anon;

-- ── system_kickoff_due_sessions(): transiciona partidas devidas pra 'live' e gera o roteiro ────
create or replace function system_kickoff_due_sessions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match     matches%rowtype;
  v_paired    matches%rowtype;
  v_roster_a  jsonb;
  v_roster_b  jsonb;
  v_eff_a     numeric;
  v_eff_b     numeric;
  v_script    jsonb;
  v_state_id  uuid;
  v_user_a    uuid;
  v_user_b    uuid;
  v_tmatch    tournament_matches%rowtype;
  v_challenge team_challenges%rowtype;
begin
  -- ── Liga: uma sessão por fixture (as 2 linhas espelho de uma partida pareada compartilham) ──
  for v_match in
    select distinct on (m.fixture_id) m.*
    from matches m
    where m.status = 'scheduled' and m.scheduled_for <= now()
    order by m.fixture_id, m.id
  loop
    v_roster_a := coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role))
      from players where team_id = v_match.team_id and status = 'online'
    ), '[]'::jsonb);
    v_eff_a := league_effective_rating(v_match.team_id);
    select user_id into v_user_a from teams where id = v_match.team_id;

    if v_match.is_placeholder_bot then
      v_roster_b := generate_bot_roster();
      v_eff_b    := v_match.opponent_rating;
      v_user_b   := null;
    else
      select * into v_paired from matches where id = v_match.paired_match_id;
      v_roster_b := coalesce((
        select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role))
        from players where team_id = v_paired.team_id and status = 'online'
      ), '[]'::jsonb);
      v_eff_b := league_effective_rating(v_paired.team_id);
      select user_id into v_user_b from teams where id = v_paired.team_id;
    end if;

    v_script := generate_match_resolution_script(v_roster_a, v_roster_b, v_eff_a, v_eff_b);

    insert into match_live_state (
      match_source, match_id, status, resolution_script, roster_a, roster_b, eff_a, eff_b,
      total_rounds, revealed_rounds, reveal_interval_seconds, next_reveal_at, kickoff_at
    ) values (
      'league', v_match.fixture_id, 'live', v_script, v_roster_a, v_roster_b, v_eff_a, v_eff_b,
      (v_script ->> 'total_rounds')::integer, 0, 113, now(), now()
    )
    on conflict (match_source, match_id) do nothing
    returning id into v_state_id;

    if v_state_id is null then
      continue; -- já existia sessão pra essa fixture
    end if;

    update matches set status = 'live' where id = v_match.id;
    if not v_match.is_placeholder_bot then
      update matches set status = 'live' where id = v_match.paired_match_id;
    end if;

    insert into notifications (user_id, type, tag, message, related_id, collapse_key)
    values (v_user_a, 'info', 'PARTIDA', 'Sua partida começou! Acompanhe ao vivo.',
            v_match.fixture_id, 'match:league:' || v_match.fixture_id);
    if v_user_b is not null then
      insert into notifications (user_id, type, tag, message, related_id, collapse_key)
      values (v_user_b, 'info', 'PARTIDA', 'Sua partida começou! Acompanhe ao vivo.',
              v_match.fixture_id, 'match:league:' || v_match.fixture_id);
    end if;
  end loop;

  -- ── Torneio: dois lados sempre reais ─────────────────────────────────────────────────────
  for v_tmatch in
    select * from tournament_matches where status = 'ready' and scheduled_for <= now()
  loop
    v_roster_a := coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role))
      from players where team_id = v_tmatch.team_a_id and status = 'online'
    ), '[]'::jsonb);
    v_roster_b := coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role))
      from players where team_id = v_tmatch.team_b_id and status = 'online'
    ), '[]'::jsonb);
    select coalesce(avg(rating), 65) into v_eff_a from players where team_id = v_tmatch.team_a_id and status = 'online';
    select coalesce(avg(rating), 65) into v_eff_b from players where team_id = v_tmatch.team_b_id and status = 'online';

    v_script := generate_match_resolution_script(v_roster_a, v_roster_b, v_eff_a, v_eff_b);

    insert into match_live_state (
      match_source, match_id, status, resolution_script, roster_a, roster_b, eff_a, eff_b,
      total_rounds, revealed_rounds, reveal_interval_seconds, next_reveal_at, kickoff_at
    ) values (
      'tournament', v_tmatch.id, 'live', v_script, v_roster_a, v_roster_b, v_eff_a, v_eff_b,
      (v_script ->> 'total_rounds')::integer, 0, 113, now(), now()
    )
    on conflict (match_source, match_id) do nothing
    returning id into v_state_id;

    if v_state_id is null then continue; end if;

    update tournament_matches set status = 'live' where id = v_tmatch.id;

    select user_id into v_user_a from teams where id = v_tmatch.team_a_id;
    select user_id into v_user_b from teams where id = v_tmatch.team_b_id;
    insert into notifications (user_id, type, tag, message, related_id, collapse_key) values
      (v_user_a, 'info', 'TORNEIO', 'Sua partida de torneio começou! Acompanhe ao vivo.',
       v_tmatch.id, 'match:tournament:' || v_tmatch.id),
      (v_user_b, 'info', 'TORNEIO', 'Sua partida de torneio começou! Acompanhe ao vivo.',
       v_tmatch.id, 'match:tournament:' || v_tmatch.id);
  end loop;

  -- ── Desafios: dois lados sempre reais ────────────────────────────────────────────────────
  for v_challenge in
    select * from team_challenges where status = 'accepted' and scheduled_for <= now()
  loop
    v_roster_a := coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role))
      from players where team_id = v_challenge.challenger_team_id and status = 'online'
    ), '[]'::jsonb);
    v_roster_b := coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role))
      from players where team_id = v_challenge.opponent_team_id and status = 'online'
    ), '[]'::jsonb);
    select coalesce(avg(rating), 65) into v_eff_a from players where team_id = v_challenge.challenger_team_id and status = 'online';
    select coalesce(avg(rating), 65) into v_eff_b from players where team_id = v_challenge.opponent_team_id and status = 'online';

    v_script := generate_match_resolution_script(v_roster_a, v_roster_b, v_eff_a, v_eff_b);

    insert into match_live_state (
      match_source, match_id, status, resolution_script, roster_a, roster_b, eff_a, eff_b,
      total_rounds, revealed_rounds, reveal_interval_seconds, next_reveal_at, kickoff_at
    ) values (
      'challenge', v_challenge.id, 'live', v_script, v_roster_a, v_roster_b, v_eff_a, v_eff_b,
      (v_script ->> 'total_rounds')::integer, 0, 113, now(), now()
    )
    on conflict (match_source, match_id) do nothing
    returning id into v_state_id;

    if v_state_id is null then continue; end if;

    update team_challenges set status = 'live' where id = v_challenge.id;

    select user_id into v_user_a from teams where id = v_challenge.challenger_team_id;
    select user_id into v_user_b from teams where id = v_challenge.opponent_team_id;
    insert into notifications (user_id, type, tag, message, related_id, collapse_key) values
      (v_user_a, 'info', 'DESAFIO', 'Seu desafio começou! Acompanhe ao vivo.',
       v_challenge.id, 'match:challenge:' || v_challenge.id),
      (v_user_b, 'info', 'DESAFIO', 'Seu desafio começou! Acompanhe ao vivo.',
       v_challenge.id, 'match:challenge:' || v_challenge.id);
  end loop;
end;
$$;

revoke execute on function system_kickoff_due_sessions() from public, authenticated, anon;

-- ── system_reveal_match_ticks(): revela o próximo round de cada sessão ao vivo devida ──────────
create or replace function system_reveal_match_ticks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state     match_live_state%rowtype;
  v_round_obj jsonb;
  v_event     jsonb;
  v_seq       integer;
  v_team_ids  uuid[];
  v_user_a    uuid;
  v_user_b    uuid;
  v_team_a_id uuid;
  v_team_b_id uuid;
begin
  for v_state in
    select * from match_live_state where status = 'live' and next_reveal_at <= now()
    for update skip locked
  loop
    v_round_obj := v_state.resolution_script -> 'rounds' -> v_state.revealed_rounds; -- 0-indexed
    if v_round_obj is null then
      update match_live_state set status = 'finalizing' where id = v_state.id;
      continue;
    end if;

    v_seq := 1;
    insert into match_events (match_source, match_id, round, seq, event_type, payload)
    values (v_state.match_source, v_state.match_id, (v_round_obj ->> 'round')::integer, v_seq,
            'round_start', jsonb_build_object('round', v_round_obj -> 'round'))
    on conflict (match_source, match_id, round, seq) do nothing;

    for v_event in select * from jsonb_array_elements(coalesce(v_round_obj -> 'events', '[]'::jsonb)) loop
      v_seq := v_seq + 1;
      insert into match_events (match_source, match_id, round, seq, event_type, payload)
      values (v_state.match_source, v_state.match_id, (v_round_obj ->> 'round')::integer, v_seq, 'kill', v_event)
      on conflict (match_source, match_id, round, seq) do nothing;
    end loop;

    v_seq := v_seq + 1;
    insert into match_events (match_source, match_id, round, seq, event_type, payload)
    values (v_state.match_source, v_state.match_id, (v_round_obj ->> 'round')::integer, v_seq, 'round_end', v_round_obj)
    on conflict (match_source, match_id, round, seq) do nothing;

    update match_live_state set
      revealed_rounds = revealed_rounds + 1,
      next_reveal_at  = now() + (reveal_interval_seconds || ' seconds')::interval
    where id = v_state.id;

    if v_state.match_source = 'league' then
      select array_agg(team_id) into v_team_ids from matches where fixture_id = v_state.match_id;
      v_team_a_id := v_team_ids[1];
      v_team_b_id := case when array_length(v_team_ids, 1) > 1 then v_team_ids[2] else null end;
    elsif v_state.match_source = 'tournament' then
      select team_a_id, team_b_id into v_team_a_id, v_team_b_id from tournament_matches where id = v_state.match_id;
    else
      select challenger_team_id, opponent_team_id into v_team_a_id, v_team_b_id from team_challenges where id = v_state.match_id;
    end if;

    -- Notificação de progresso a cada 5 rounds revelados (não a cada round, pra não virar spam).
    if (v_state.revealed_rounds + 1) % 5 = 0 then
      select user_id into v_user_a from teams where id = v_team_a_id;
      insert into notifications (user_id, type, tag, message, related_id, collapse_key)
      values (v_user_a, 'info', 'PARTIDA',
              'Placar parcial: ' || (v_round_obj ->> 'score_a') || ' - ' || (v_round_obj ->> 'score_b'),
              v_state.match_id, 'match:' || v_state.match_source || ':' || v_state.match_id);

      if v_team_b_id is not null then
        select user_id into v_user_b from teams where id = v_team_b_id;
        insert into notifications (user_id, type, tag, message, related_id, collapse_key)
        values (v_user_b, 'info', 'PARTIDA',
                'Placar parcial: ' || (v_round_obj ->> 'score_b') || ' - ' || (v_round_obj ->> 'score_a'),
                v_state.match_id, 'match:' || v_state.match_source || ':' || v_state.match_id);
      end if;
    end if;

    -- Último round revelado -> insere match_end e passa pra finalizing.
    if v_state.revealed_rounds + 1 >= v_state.total_rounds then
      v_seq := v_seq + 1;
      insert into match_events (match_source, match_id, round, seq, event_type, payload)
      values (v_state.match_source, v_state.match_id, (v_round_obj ->> 'round')::integer, v_seq, 'match_end',
              jsonb_build_object(
                'final_score_a', v_state.resolution_script ->> 'final_score_a',
                'final_score_b', v_state.resolution_script ->> 'final_score_b'
              ))
      on conflict (match_source, match_id, round, seq) do nothing;

      update match_live_state set status = 'finalizing' where id = v_state.id;
    end if;
  end loop;
end;
$$;

revoke execute on function system_reveal_match_ticks() from public, authenticated, anon;

-- ── system_finalize_matches(): grava resultado final, economia, prêmios e notificação ──────────
create or replace function system_finalize_matches()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state        match_live_state%rowtype;
  v_final_a      integer;
  v_final_b      integer;
  -- liga
  v_match_a      matches%rowtype;
  v_match_b      matches%rowtype;
  v_diff         numeric;
  v_won          boolean;
  v_pdl_delta    integer;
  v_fans_delta   integer;
  v_budget_delta integer;
  v_morale_delta integer;
  v_injury_roll  numeric;
  v_injured_id   uuid;
  v_injured_name text;
  v_injury_days  integer;
  v_pre_tier     text;
  v_pre_pdl      integer;
  v_season       seasons%rowtype;
  -- torneio
  v_tmatch       tournament_matches%rowtype;
  v_tournament   tournaments%rowtype;
  v_total_rounds integer;
  v_next_round   integer;
  v_next_slot    integer;
  v_winner       uuid;
  v_loser        uuid;
  -- desafio
  v_challenge    team_challenges%rowtype;
  v_last_reward  timestamptz;
  -- comuns
  v_user_a       uuid;
  v_user_b       uuid;
  v_match_energy_cost constant integer := 15;
begin
  for v_state in
    select * from match_live_state where status = 'finalizing' for update skip locked
  loop
    v_final_a := (v_state.resolution_script ->> 'final_score_a')::integer;
    v_final_b := (v_state.resolution_script ->> 'final_score_b')::integer;

    if v_state.match_source = 'league' then
      select * into v_match_a from matches where fixture_id = v_state.match_id order by id limit 1;
      v_match_b := null;
      if v_match_a.paired_match_id is not null then
        select * into v_match_b from matches where id = v_match_a.paired_match_id;
      end if;

      -- Lado A: mesma fórmula de deltas que resolve_match já usava, só que agora com a força
      -- efetiva REAL do adversário (v_state.eff_b) em vez de um snapshot congelado.
      v_won := v_final_a > v_final_b;
      v_diff := v_state.eff_b - v_state.eff_a;
      v_pdl_delta := case
        when v_won then round(greatest(5, least(40, 20 + v_diff * 0.6)))
        else -round(greatest(5, least(30, 15 - v_diff * 0.6)))
      end;
      v_fans_delta   := case when v_won then 200 + floor(random() * 601)::int else -(80 + floor(random() * 221)::int) end;
      v_budget_delta := case when v_won then 1000 + floor(random() * 4001)::int else 0 end;

      -- Captura o pdl ANTES do update abaixo -> season_standings precisa creditar a tier em que
      -- o time estava antes do resultado (mesmo critério de resolve_match).
      select pdl into v_pre_pdl from teams where id = v_match_a.team_id;

      update matches set
        status = 'played', result = case when v_won then 'win' else 'loss' end,
        score_own = v_final_a, score_opp = v_final_b,
        fans_delta = v_fans_delta, budget_delta = v_budget_delta, pdl_delta = v_pdl_delta,
        played_at = now()
        where id = v_match_a.id;

      update teams set
        fans = greatest(0, fans + v_fans_delta), budget = budget + v_budget_delta,
        wins = wins + case when v_won then 1 else 0 end,
        losses = losses + case when v_won then 0 else 1 end,
        pdl = greatest(0, pdl + v_pdl_delta)
        where id = v_match_a.team_id;

      perform regen_energy_for_team(v_match_a.team_id);
      update players set energy = greatest(0, energy - v_match_energy_cost) where team_id = v_match_a.team_id;

      v_morale_delta := 5 + floor(random() * 6)::int;
      update players set morale = case when v_won then least(100, morale + v_morale_delta)
                                        else greatest(0, morale - v_morale_delta) end
        where team_id = v_match_a.team_id;

      v_injury_roll := random();
      if v_injury_roll < 0.08 then
        select id, name into v_injured_id, v_injured_name from players
          where team_id = v_match_a.team_id and status = 'online' order by random() limit 1;
        if v_injured_id is not null then
          v_injury_days := 1 + floor(random() * 3)::int;
          update players set status = 'injured', injury_ends_at = now() + (v_injury_days || ' days')::interval
            where id = v_injured_id;
          select user_id into v_user_a from teams where id = v_match_a.team_id;
          insert into notifications (user_id, type, tag, message)
          values (v_user_a, 'alert', 'LESÃO', v_injured_name || ' se lesionou na partida — fora por ' || v_injury_days || ' dia(s).');
        end if;
      end if;

      v_pre_tier := tier_for_pdl(coalesce(v_pre_pdl, 0));
      v_season := get_or_create_season(v_pre_tier);
      update season_standings set
        points = points + case when v_won then 3 else 0 end,
        wins = wins + case when v_won then 1 else 0 end,
        losses = losses + case when v_won then 0 else 1 end,
        matches_played = matches_played + 1, updated_at = now()
        where season_id = v_season.id and team_id = v_match_a.team_id;

      select user_id into v_user_a from teams where id = v_match_a.team_id;
      insert into notifications (user_id, type, tag, message, related_id, collapse_key)
      values (v_user_a, 'success', 'PARTIDA', 'Partida encerrada: ' || v_final_a || ' - ' || v_final_b,
              v_state.match_id, 'match:league:' || v_state.match_id);

      -- Lado B (espelho), só se for par real (não bot).
      if v_match_b.id is not null then
        v_won := v_final_b > v_final_a;
        v_diff := v_state.eff_a - v_state.eff_b;
        v_pdl_delta := case
          when v_won then round(greatest(5, least(40, 20 + v_diff * 0.6)))
          else -round(greatest(5, least(30, 15 - v_diff * 0.6)))
        end;
        v_fans_delta   := case when v_won then 200 + floor(random() * 601)::int else -(80 + floor(random() * 221)::int) end;
        v_budget_delta := case when v_won then 1000 + floor(random() * 4001)::int else 0 end;

        select pdl into v_pre_pdl from teams where id = v_match_b.team_id;

        update matches set
          status = 'played', result = case when v_won then 'win' else 'loss' end,
          score_own = v_final_b, score_opp = v_final_a,
          fans_delta = v_fans_delta, budget_delta = v_budget_delta, pdl_delta = v_pdl_delta,
          played_at = now()
          where id = v_match_b.id;

        update teams set
          fans = greatest(0, fans + v_fans_delta), budget = budget + v_budget_delta,
          wins = wins + case when v_won then 1 else 0 end,
          losses = losses + case when v_won then 0 else 1 end,
          pdl = greatest(0, pdl + v_pdl_delta)
          where id = v_match_b.team_id;

        perform regen_energy_for_team(v_match_b.team_id);
        update players set energy = greatest(0, energy - v_match_energy_cost) where team_id = v_match_b.team_id;

        v_morale_delta := 5 + floor(random() * 6)::int;
        update players set morale = case when v_won then least(100, morale + v_morale_delta)
                                          else greatest(0, morale - v_morale_delta) end
          where team_id = v_match_b.team_id;

        v_injury_roll := random();
        if v_injury_roll < 0.08 then
          select id, name into v_injured_id, v_injured_name from players
            where team_id = v_match_b.team_id and status = 'online' order by random() limit 1;
          if v_injured_id is not null then
            v_injury_days := 1 + floor(random() * 3)::int;
            update players set status = 'injured', injury_ends_at = now() + (v_injury_days || ' days')::interval
              where id = v_injured_id;
            select user_id into v_user_b from teams where id = v_match_b.team_id;
            insert into notifications (user_id, type, tag, message)
            values (v_user_b, 'alert', 'LESÃO', v_injured_name || ' se lesionou na partida — fora por ' || v_injury_days || ' dia(s).');
          end if;
        end if;

        v_pre_tier := tier_for_pdl(coalesce(v_pre_pdl, 0));
        v_season := get_or_create_season(v_pre_tier);
        update season_standings set
          points = points + case when v_won then 3 else 0 end,
          wins = wins + case when v_won then 1 else 0 end,
          losses = losses + case when v_won then 0 else 1 end,
          matches_played = matches_played + 1, updated_at = now()
          where season_id = v_season.id and team_id = v_match_b.team_id;

        select user_id into v_user_b from teams where id = v_match_b.team_id;
        insert into notifications (user_id, type, tag, message, related_id, collapse_key)
        values (v_user_b, 'success', 'PARTIDA', 'Partida encerrada: ' || v_final_b || ' - ' || v_final_a,
                v_state.match_id, 'match:league:' || v_state.match_id);
      end if;

    elsif v_state.match_source = 'tournament' then
      select * into v_tmatch from tournament_matches where id = v_state.match_id for update;
      v_winner := case when v_final_a > v_final_b then v_tmatch.team_a_id else v_tmatch.team_b_id end;
      v_loser  := case when v_final_a > v_final_b then v_tmatch.team_b_id else v_tmatch.team_a_id end;

      update tournament_matches set
        status = 'played', score_a = v_final_a, score_b = v_final_b,
        winner_team_id = v_winner, played_at = now()
        where id = v_tmatch.id;

      select * into v_tournament from tournaments where id = v_tmatch.tournament_id;
      v_total_rounds := round(log(2, v_tournament.bracket_size))::integer;

      if v_tmatch.round < v_total_rounds then
        v_next_round := v_tmatch.round + 1;
        v_next_slot  := v_tmatch.slot / 2;
        if v_tmatch.slot % 2 = 0 then
          update tournament_matches set team_a_id = v_winner, team_a_name = (select name from teams where id = v_winner)
            where tournament_id = v_tmatch.tournament_id and round = v_next_round and slot = v_next_slot;
        else
          update tournament_matches set team_b_id = v_winner, team_b_name = (select name from teams where id = v_winner)
            where tournament_id = v_tmatch.tournament_id and round = v_next_round and slot = v_next_slot;
        end if;
        update tournament_matches set status = 'ready', scheduled_for = now() + interval '1 day'
          where tournament_id = v_tmatch.tournament_id and round = v_next_round and slot = v_next_slot
            and team_a_id is not null and team_b_id is not null and status = 'pending';
      else
        update teams set budget = budget + 5000, fans = fans + 1000, pdl = pdl + 40, premium_credits = premium_credits + 300
          where id = v_winner;
        update teams set budget = budget + 2000, fans = fans + 400, pdl = pdl + 15
          where id = v_loser;
        update tournaments set status = 'completed' where id = v_tmatch.tournament_id;
      end if;

      select user_id into v_user_a from teams where id = v_tmatch.team_a_id;
      select user_id into v_user_b from teams where id = v_tmatch.team_b_id;
      insert into notifications (user_id, type, tag, message, related_id, collapse_key) values
        (v_user_a, 'success', 'TORNEIO', 'Partida de torneio encerrada: ' || v_final_a || ' - ' || v_final_b,
         v_state.match_id, 'match:tournament:' || v_state.match_id),
        (v_user_b, 'success', 'TORNEIO', 'Partida de torneio encerrada: ' || v_final_b || ' - ' || v_final_a,
         v_state.match_id, 'match:tournament:' || v_state.match_id);

    else -- challenge
      select * into v_challenge from team_challenges where id = v_state.match_id for update;
      v_winner := case when v_final_a > v_final_b then v_challenge.challenger_team_id else v_challenge.opponent_team_id end;

      update team_challenges set
        status = 'played', score_challenger = v_final_a, score_opponent = v_final_b,
        winner_team_id = v_winner, played_at = now()
        where id = v_challenge.id;

      select last_challenge_reward_at into v_last_reward from teams where id = v_winner;
      if v_last_reward is null or v_last_reward <= now() - interval '4 hours' then
        update teams set fans = fans + 150, last_challenge_reward_at = now() where id = v_winner;
      end if;

      select user_id into v_user_a from teams where id = v_challenge.challenger_team_id;
      select user_id into v_user_b from teams where id = v_challenge.opponent_team_id;
      insert into notifications (user_id, type, tag, message, related_id, collapse_key) values
        (v_user_a, 'success', 'DESAFIO', 'Desafio encerrado: ' || v_final_a || ' - ' || v_final_b,
         v_state.match_id, 'match:challenge:' || v_state.match_id),
        (v_user_b, 'success', 'DESAFIO', 'Desafio encerrado: ' || v_final_b || ' - ' || v_final_a,
         v_state.match_id, 'match:challenge:' || v_state.match_id);
    end if;

    update match_live_state set status = 'played', finalized_at = now() where id = v_state.id;
  end loop;
end;
$$;

revoke execute on function system_finalize_matches() from public, authenticated, anon;

-- ── Fecha a janela de corrida: resolução de partida deixa de ser algo que o client dispara ────
-- A partir de agora só as funções system_* (chamadas pelo pg_cron) decidem resultado. Sem esse
-- revoke, um client rápido ainda conseguiria chamar o modelo antigo (instantâneo, sem simulação
-- ao vivo) antes do cron fazer o kickoff da sessão nova.
revoke execute on function resolve_match(uuid, jsonb) from authenticated;
revoke execute on function resolve_tournament_match(uuid) from authenticated;
revoke execute on function resolve_challenge_match(uuid) from authenticated;
