-- Migration 033: Season Pass (Fase 2 do plano de monetização)
-- Run this AFTER migration 032
--
-- Trilha de recompensas atrelada ao ciclo de temporada já existente (`seasons`/
-- `season_standings`). Progresso = `season_standings.points` do time na temporada atual da
-- própria tier (o mesmo campo que já alimenta a classificação da liga) — sem tabela de XP nova.
-- Trilha gratuita: todo mundo pode reivindicar. Trilha premium: só times com assinatura ativa
-- (`teams.season_pass_active`), concedida via webhook do RevenueCat, nunca pelo client direto.

-- ── 1. Estado da assinatura no time ──────────────────────────────────────────────────────────
-- Mesma regra das outras colunas de economia: fora do grant de UPDATE do client (migration 017
-- só libera name/onboarded), só as funções abaixo escrevem aqui.
alter table teams add column if not exists season_pass_active boolean not null default false;
alter table teams add column if not exists season_pass_renews_at timestamptz;

-- ── 2. Cosméticos exclusivos do pass não entram na loja normal ─────────────────────────────
alter table cosmetics add column if not exists source text not null default 'shop'
  check (source in ('shop', 'season_pass'));

insert into cosmetics (key, category, name, description, price_credits, preview, source) values
  ('name_pass_diamond',    'name_color',   'Nome Diamante da Temporada', 'Exclusivo do Season Pass premium.', 9999, '{"color": "#22D3EE"}', 'season_pass'),
  ('frame_pass_legendary', 'player_frame', 'Moldura Lendária da Temporada', 'Exclusiva do Season Pass premium.', 9999, '{"color": "#F472B6"}', 'season_pass')
on conflict (key) do nothing;

-- ── 3. Catálogo de tiers do pass (mesmo pra toda temporada/tier de elo) ─────────────────────
create table if not exists season_pass_tiers (
  tier_number     integer primary key,
  points_required integer not null check (points_required > 0),
  free_reward     jsonb not null,    -- {"type": "fans"|"budget", "amount": n}
  premium_reward  jsonb not null     -- {"type": "fans"|"budget"|"credits", "amount": n} | {"type": "cosmetic", "cosmetic_id": uuid}
);

alter table season_pass_tiers enable row level security;

create policy "Anyone authenticated can view season pass tiers"
  on season_pass_tiers for select
  to authenticated
  using (true);

insert into season_pass_tiers (tier_number, points_required, free_reward, premium_reward) values
  (1,  3,   jsonb_build_object('type','fans','amount',50),     jsonb_build_object('type','credits','amount',100)),
  (2,  9,   jsonb_build_object('type','budget','amount',500),  jsonb_build_object('type','credits','amount',150)),
  (3,  15,  jsonb_build_object('type','fans','amount',80),     jsonb_build_object('type','credits','amount',200)),
  (4,  24,  jsonb_build_object('type','budget','amount',800),  jsonb_build_object('type','credits','amount',250)),
  (5,  33,  jsonb_build_object('type','fans','amount',120),    jsonb_build_object('type','credits','amount',300)),
  (6,  45,  jsonb_build_object('type','budget','amount',1200), jsonb_build_object('type','cosmetic','cosmetic_id', (select id from cosmetics where key = 'name_pass_diamond'))),
  (7,  60,  jsonb_build_object('type','fans','amount',150),    jsonb_build_object('type','credits','amount',400)),
  (8,  78,  jsonb_build_object('type','budget','amount',1500), jsonb_build_object('type','credits','amount',450)),
  (9,  99,  jsonb_build_object('type','fans','amount',200),    jsonb_build_object('type','credits','amount',500)),
  (10, 123, jsonb_build_object('type','budget','amount',2000), jsonb_build_object('type','credits','amount',600)),
  (11, 150, jsonb_build_object('type','fans','amount',250),    jsonb_build_object('type','credits','amount',700)),
  (12, 180, jsonb_build_object('type','budget','amount',3000), jsonb_build_object('type','cosmetic','cosmetic_id', (select id from cosmetics where key = 'frame_pass_legendary')))
on conflict (tier_number) do nothing;

-- ── 4. Ledger de recompensas já reivindicadas (idempotência, por temporada) ─────────────────
create table if not exists season_pass_claims (
  team_id     uuid not null references teams(id) on delete cascade,
  season_id   uuid not null references seasons(id) on delete cascade,
  tier_number integer not null references season_pass_tiers(tier_number),
  track       text not null check (track in ('free', 'premium')),
  claimed_at  timestamptz not null default now(),
  primary key (team_id, season_id, tier_number, track)
);

alter table season_pass_claims enable row level security;

create policy "Users can view their own season pass claims"
  on season_pass_claims for select
  to authenticated
  using (team_id in (select id from teams where user_id = auth.uid()));

-- Sem policy de insert/update/delete -> só a função abaixo escreve aqui.

-- ── 5. claim_season_pass_reward: reivindica uma recompensa (client-callable) ────────────────
create or replace function claim_season_pass_reward(p_tier_number integer, p_track text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team           teams%rowtype;
  v_pre_tier       text;
  v_season         seasons%rowtype;
  v_points         integer;
  v_tier           season_pass_tiers%rowtype;
  v_reward         jsonb;
  v_reward_type    text;
  v_reward_amount  integer;
  v_cosmetic_id    uuid;
begin
  if p_track not in ('free', 'premium') then
    raise exception 'invalid_track';
  end if;

  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  if p_track = 'premium' and not v_team.season_pass_active then
    raise exception 'season_pass_required';
  end if;

  v_pre_tier := tier_for_pdl(v_team.pdl);
  v_season := get_or_create_season(v_pre_tier);

  select points into v_points
    from season_standings
    where season_id = v_season.id and team_id = v_team.id;
  v_points := coalesce(v_points, 0);

  select * into v_tier from season_pass_tiers where tier_number = p_tier_number;
  if not found then
    raise exception 'tier_not_found';
  end if;

  if v_points < v_tier.points_required then
    raise exception 'tier_locked';
  end if;

  if exists (
    select 1 from season_pass_claims
    where team_id = v_team.id and season_id = v_season.id
      and tier_number = p_tier_number and track = p_track
  ) then
    raise exception 'already_claimed';
  end if;

  insert into season_pass_claims (team_id, season_id, tier_number, track)
  values (v_team.id, v_season.id, p_tier_number, p_track);

  v_reward := case p_track when 'free' then v_tier.free_reward else v_tier.premium_reward end;
  v_reward_type := v_reward ->> 'type';

  if v_reward_type = 'cosmetic' then
    v_cosmetic_id := (v_reward ->> 'cosmetic_id')::uuid;
    insert into team_cosmetics (team_id, cosmetic_id)
      values (v_team.id, v_cosmetic_id)
      on conflict (team_id, cosmetic_id) do nothing;
  else
    v_reward_amount := (v_reward ->> 'amount')::integer;
    if v_reward_type = 'credits' then
      update teams set premium_credits = premium_credits + v_reward_amount where id = v_team.id;
    elsif v_reward_type = 'fans' then
      update teams set fans = greatest(0, fans + v_reward_amount) where id = v_team.id;
    elsif v_reward_type = 'budget' then
      update teams set budget = budget + v_reward_amount where id = v_team.id;
    end if;
  end if;

  return v_reward;
end;
$$;

grant execute on function claim_season_pass_reward(integer, text) to authenticated;

-- ── 6. set_season_pass_active: só o webhook do RevenueCat chama isso ───────────────────────
create or replace function set_season_pass_active(p_team_id uuid, p_active boolean, p_renews_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update teams
    set season_pass_active = p_active,
        season_pass_renews_at = p_renews_at
    where id = p_team_id;
end;
$$;

revoke execute on function set_season_pass_active(uuid, boolean, timestamptz) from public, authenticated, anon;

-- ── 7. check_season_pass_expiry: lazy-cron, chamada oportunista do client (padrão já usado
-- por check_expired_contracts / check_recovered_players / etc.) ────────────────────────────
create or replace function check_season_pass_expiry()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update teams
    set season_pass_active = false
    where user_id = auth.uid()
      and season_pass_active
      and season_pass_renews_at is not null
      and season_pass_renews_at < now();
end;
$$;

grant execute on function check_season_pass_expiry() to authenticated;

-- ── 8. purchase_cosmetic não pode vender item exclusivo do pass ────────────────────────────
create or replace function purchase_cosmetic(p_cosmetic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id  uuid;
  v_credits  integer;
  v_price    integer;
  v_active   boolean;
  v_source   text;
begin
  select id, premium_credits into v_team_id, v_credits from teams where user_id = auth.uid();
  if v_team_id is null then
    raise exception 'team_not_found';
  end if;

  select price_credits, is_active, source into v_price, v_active, v_source from cosmetics where id = p_cosmetic_id;
  if v_price is null then
    raise exception 'cosmetic_not_found';
  end if;
  if not v_active then
    raise exception 'cosmetic_unavailable';
  end if;
  if v_source <> 'shop' then
    raise exception 'cosmetic_not_purchasable';
  end if;

  if exists (select 1 from team_cosmetics where team_id = v_team_id and cosmetic_id = p_cosmetic_id) then
    raise exception 'already_owned';
  end if;

  if v_credits < v_price then
    raise exception 'insufficient_credits';
  end if;

  update teams set premium_credits = premium_credits - v_price where id = v_team_id;
  insert into team_cosmetics (team_id, cosmetic_id) values (v_team_id, p_cosmetic_id);

  return jsonb_build_object('remaining_credits', v_credits - v_price);
end;
$$;

grant execute on function purchase_cosmetic(uuid) to authenticated;
