-- Migration 021: Corrige "Solicitar Partida" (botão fica no loading e não faz nada)
-- Run this AFTER migration 020
--
-- Causa: `requestNextMatch` no client fazia INSERT direto em `matches`, mas essa tabela nunca
-- teve policy de INSERT para `authenticated` — o insert sempre falhou silenciosamente (o
-- código não checava o `error` do insert). A RPC `generate_next_match` (migration 015) já
-- existia pronta pra isso mas nunca foi chamada pelo app.
--
-- Também não dá pra simplesmente adicionar uma policy de INSERT permissiva: o client escolhia
-- `opponent_rating` sozinho, e como `resolve_match` (017/018) usa esse valor pra calcular
-- chance de vitória e delta de PDL, um client malicioso poderia inserir um adversário com
-- rating artificialmente baixo pra garantir vitórias fáceis. Por isso a criação da partida
-- continua sendo só via função SECURITY DEFINER, agora reescrita pra reproduzir a lógica que
-- já existia no client: adversário real na mesma faixa de tier (mesmo critério de
-- `tier_for_pdl`, migration 018) ou, se não houver, um bot mais fraco que o elenco do próprio
-- time.
--
-- Simplificação assumida: o horário da partida (14h/17h) agora é calculado em UTC no
-- servidor, não mais no fuso local do aparelho do usuário.

drop function if exists generate_next_match(uuid);

create or replace function tier_pdl_bounds(p_tier text, out p_min integer, out p_max integer)
returns record
language sql
immutable
as $$
  select
    case p_tier
      when 'Bronze'      then 0
      when 'Prata'       then 300
      when 'Ouro'        then 600
      when 'Platina'     then 900
      when 'Diamante'    then 1200
      when 'Mestre'      then 1500
      when 'Grão-Mestre' then 1800
    end,
    case p_tier
      when 'Bronze'      then 300
      when 'Prata'       then 600
      when 'Ouro'        then 900
      when 'Platina'     then 1200
      when 'Diamante'    then 1500
      when 'Mestre'      then 1800
      when 'Grão-Mestre' then 2147483647
    end;
$$;

create or replace function generate_next_match()
returns matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team            teams%rowtype;
  v_tier            text;
  v_tier_min        integer;
  v_tier_max        integer;
  v_my_avg          numeric;
  v_opponent_id     uuid;
  v_opponent_name   text;
  v_opponent_rating integer;
  v_names           text[] := array[
    'Thunder','Nova','Rage','Apex','Storm','Ghost','Blaze','Phantom',
    'Vortex','Nexus','Cipher','Havoc','Surge','Raven','Echo','Wraith',
    'Titan','Sentinel','Eclipse','Zenith'
  ];
  v_suffixes        text[] := array['Gaming','Esports','GG','Team','Force','Squad','Core','Play'];
  v_maps            text[] := array['Mirage','Inferno','Nuke','Ancient','Anubis','Vertigo','Dust2'];
  v_types           text[] := array['Liga','Torneio','Scrim','Final'];
  v_scheduled_for   timestamptz;
  v_match           matches%rowtype;
begin
  select t.* into v_team from teams t where t.user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  if exists (select 1 from matches where team_id = v_team.id and status = 'scheduled') then
    raise exception 'match_already_scheduled';
  end if;

  v_tier := tier_for_pdl(coalesce(v_team.pdl, 0));
  select p_min, p_max into v_tier_min, v_tier_max from tier_pdl_bounds(v_tier);

  -- Adversário real na mesma faixa de tier, exceto o próprio time
  select t.id, t.name,
    coalesce((select round(avg(p.rating))::integer from players p where p.team_id = t.id), 60)
  into v_opponent_id, v_opponent_name, v_opponent_rating
  from teams t
  where t.id != v_team.id
    and t.onboarded = true
    and t.pdl >= v_tier_min and t.pdl < v_tier_max
  order by random()
  limit 1;

  -- Fallback: bot mais fraco que o elenco do próprio time
  if v_opponent_name is null then
    select coalesce(round(avg(rating)), 65) into v_my_avg from players where team_id = v_team.id;
    v_opponent_id     := null;
    v_opponent_name   := v_names[1 + floor(random() * array_length(v_names, 1))::int]
                          || ' ' || v_suffixes[1 + floor(random() * array_length(v_suffixes, 1))::int];
    v_opponent_rating := greatest(30, (v_my_avg - (5 + floor(random() * 10)::int))::integer);
  end if;

  -- Próximo horário disponível: hoje/amanhã às 14h ou 17h UTC, com pelo menos 10min de
  -- antecedência; se nenhum slot servir, cai pra depois de amanhã às 14h.
  select c into v_scheduled_for
  from (
    select date_trunc('day', now()) + (d || ' days')::interval + (h || ' hours')::interval as c
    from generate_series(0, 1) d, unnest(array[14, 17]) h
    order by c
  ) slots
  where c > now() + interval '10 minutes'
  limit 1;

  if v_scheduled_for is null then
    v_scheduled_for := date_trunc('day', now()) + interval '2 days' + interval '14 hours';
  end if;

  insert into matches (
    team_id, opponent_team_id, opponent_name, opponent_rating,
    scheduled_for, map, match_type, status, is_bot
  ) values (
    v_team.id, v_opponent_id, v_opponent_name, v_opponent_rating,
    v_scheduled_for,
    v_maps[1 + floor(random() * array_length(v_maps, 1))::int],
    v_types[1 + floor(random() * array_length(v_types, 1))::int],
    'scheduled',
    v_opponent_id is null
  )
  returning * into v_match;

  return v_match;
end;
$$;

grant execute on function generate_next_match() to authenticated;
