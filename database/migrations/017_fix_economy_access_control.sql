-- Migration 017: Corrige controle de acesso quebrado em escritas que afetam economia/ranking
-- Run this AFTER migration 016
--
-- Vulnerabilidades corrigidas (revisão de segurança):
--  1. `teams` UPDATE não restringia colunas -> o client escrevia budget/pdl/wins/losses/fans
--     diretamente via `supabase.from("teams").update(...)`, permitindo economia infinita.
--  2. `matches` UPDATE não restringia colunas -> o client marcava partidas como vencidas com
--     deltas arbitrários via `supabase.from("matches").update(...)`, sem nunca "jogar".
--  3. `auctions` UPDATE (place bid) não validava dono do lance, valor mínimo nem saldo -> o
--     client escrevia `current_bid`/`current_bidder_team_id` livremente via
--     `supabase.from("auctions").update(...)`.
--
-- Estratégia: revogar escrita direta dessas colunas do role `authenticated` e mover toda
-- escrita que afeta economia/ranking para funções SECURITY DEFINER que validam e calculam
-- o resultado no servidor (mesmo padrão já usado em `buy_player_direct` e `generate_next_match`).

-- ── 1. teams: cliente só pode alterar campos cosméticos (nome / onboarding) ─────────────────
revoke insert, update on teams from authenticated;
grant insert (user_id, name, onboarded) on teams to authenticated;
grant update (name, onboarded) on teams to authenticated;

-- ── 2. matches: cliente não escreve mais resultado/deltas diretamente ───────────────────────
revoke update on matches from authenticated;

-- ── 3. auctions: cliente não escreve mais lance diretamente ─────────────────────────────────
drop policy if exists "Authenticated users can place bids" on auctions;
revoke update on auctions from authenticated;

-- ── resolve_match(): simulação autoritativa no servidor ─────────────────────────────────────
-- Recalcula won/score/pdl_delta/fans_delta/budget_delta a partir dos jogadores e táticas reais
-- do time (não confia em nenhum valor vindo do client, exceto o array cosmético de estatísticas
-- por jogador — que não tem impacto de segurança, é só exibição).
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

-- ── place_bid(): lance autoritativo no servidor ──────────────────────────────────────────────
-- Valida dono do time, valor mínimo, saldo e prazo antes de gravar o lance.
create or replace function place_bid(p_listing_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team    teams%rowtype;
  v_listing auctions%rowtype;
begin
  select t.* into v_team from teams t where t.user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select a.* into v_listing from auctions a
    where a.id = p_listing_id
      and a.status = 'active'
      and a.listing_type = 'auction'
    for update;

  if not found then
    raise exception 'listing_not_available';
  end if;

  if v_listing.seller_team_id = v_team.id then
    raise exception 'cannot_bid_own_player';
  end if;

  if v_listing.ends_at <= now() then
    raise exception 'auction_ended';
  end if;

  if p_amount < v_listing.start_price or p_amount <= v_listing.current_bid then
    raise exception 'bid_too_low';
  end if;

  if v_team.budget < p_amount then
    raise exception 'insufficient_budget';
  end if;

  update auctions
    set current_bid = p_amount, current_bidder_team_id = v_team.id
    where id = p_listing_id;
end;
$$;

grant execute on function place_bid(uuid, integer) to authenticated;
