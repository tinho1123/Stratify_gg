-- Migration 066: generate_next_match() passa a tentar parear dois times reais de verdade
-- Run this AFTER migration 065
--
-- Mesma assinatura de sempre (client não muda a chamada) — só a lógica interna muda: em vez de
-- só anotar um snapshot decorativo de um time real (nunca usado na resolução), agora tenta
-- casar o time chamador com outro time já esperando na fila (`match_queue`) da mesma faixa de
-- tier, criando duas linhas espelho compartilhando `fixture_id` — exatamente o que
-- `system_kickoff_due_sessions`/`generate_match_resolution_script` (migration 065) esperam pra
-- rodar uma partida PvP real. Se não achar par na hora, cai no fallback de sempre (bot) e entra
-- na fila pro job de matchmaking (`system_match_matchmaking_tick`) tentar parear antes do
-- kickoff.

drop function if exists generate_next_match();

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
  v_scheduled_for   timestamptz;
  v_partner         match_queue%rowtype;
  v_partner_match   matches%rowtype;
  v_match           matches%rowtype;
  v_queue_row       match_queue%rowtype;
  v_my_avg          numeric;
  v_opponent_name   text;
  v_opponent_rating integer;
  v_names    text[] := array[
    'Thunder','Nova','Rage','Apex','Storm','Ghost','Blaze','Phantom',
    'Vortex','Nexus','Cipher','Havoc','Surge','Raven','Echo','Wraith',
    'Titan','Sentinel','Eclipse','Zenith'
  ];
  v_suffixes text[] := array['Gaming','Esports','GG','Team','Force','Squad','Core','Play'];
  v_maps     text[] := array['Mirage','Inferno','Nuke','Ancient','Anubis','Vertigo','Dust2'];
  v_types    text[] := array['Liga','Torneio','Scrim','Final'];
begin
  select t.* into v_team from teams t where t.user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  if exists (select 1 from matches where team_id = v_team.id and status in ('scheduled', 'live')) then
    raise exception 'match_already_scheduled';
  end if;

  v_tier := tier_for_pdl(coalesce(v_team.pdl, 0));
  select p_min, p_max into v_tier_min, v_tier_max from tier_pdl_bounds(v_tier);

  -- Próximo horário disponível: hoje/amanhã às 14h ou 17h UTC, com pelo menos 10min de
  -- antecedência; se nenhum slot servir, cai pra depois de amanhã às 14h. Só usado se não
  -- pareamos imediatamente (pareamento reaproveita o horário já reservado pelo parceiro).
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

  -- ── Tenta parear imediatamente com alguém já esperando na fila da mesma tier ────────────────
  select * into v_partner from match_queue
    where status = 'waiting' and tier = v_tier and team_id <> v_team.id
    order by queued_at
    for update skip locked
    limit 1;

  if v_partner.id is not null then
    select * into v_partner_match from matches where queue_id = v_partner.id;

    insert into matches (
      team_id, opponent_team_id, opponent_name, opponent_rating,
      scheduled_for, map, match_type, status, is_bot, is_placeholder_bot, fixture_id, paired_match_id
    ) values (
      v_team.id, v_partner_match.team_id,
      (select name from teams where id = v_partner_match.team_id),
      round(league_effective_rating(v_partner_match.team_id))::integer,
      v_partner_match.scheduled_for, -- mesmo horário do parceiro -> os dois lados fazem kickoff juntos
      v_maps[1 + floor(random() * array_length(v_maps, 1))::int],
      v_types[1 + floor(random() * array_length(v_types, 1))::int],
      'scheduled', false, false,
      v_partner_match.fixture_id, v_partner_match.id
    )
    returning * into v_match;

    update matches set
      opponent_team_id   = v_team.id,
      opponent_name      = v_team.name,
      opponent_rating    = round(league_effective_rating(v_team.id))::integer,
      paired_match_id     = v_match.id,
      is_bot              = false,
      is_placeholder_bot  = false
      where id = v_partner_match.id;

    update match_queue set status = 'matched', matched_match_id = v_match.id where id = v_partner.id;

    return v_match;
  end if;

  -- ── Sem par imediato: fallback bot de sempre (placeholder), e entra na fila pro job de
  -- matchmaking tentar achar um adversário real antes do kickoff.
  select coalesce(round(avg(rating)), 65) into v_my_avg from players where team_id = v_team.id;
  v_opponent_name := v_names[1 + floor(random() * array_length(v_names, 1))::int]
                      || ' ' || v_suffixes[1 + floor(random() * array_length(v_suffixes, 1))::int];
  v_opponent_rating := greatest(30, (v_my_avg - (5 + floor(random() * 10)::int))::integer);

  insert into matches (
    team_id, opponent_team_id, opponent_name, opponent_rating,
    scheduled_for, map, match_type, status, is_bot, is_placeholder_bot
  ) values (
    v_team.id, null, v_opponent_name, v_opponent_rating,
    v_scheduled_for,
    v_maps[1 + floor(random() * array_length(v_maps, 1))::int],
    v_types[1 + floor(random() * array_length(v_types, 1))::int],
    'scheduled', true, true
  )
  returning * into v_match;

  insert into match_queue (team_id, tier, pdl_snapshot, desired_kickoff, status)
  values (v_team.id, v_tier, coalesce(v_team.pdl, 0), v_scheduled_for, 'waiting')
  returning * into v_queue_row;

  update matches set queue_id = v_queue_row.id where id = v_match.id;
  v_match.queue_id := v_queue_row.id;

  return v_match;
end;
$$;

grant execute on function generate_next_match() to authenticated;
