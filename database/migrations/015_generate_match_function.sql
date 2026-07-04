-- Migration 015: Função para gerar próxima partida agendada
-- Run this AFTER migration 014
--
-- Esta função roda como SECURITY DEFINER para poder acessar times adversários
-- sem precisar expor RLS entre usuários.
-- É chamada pelo client (via RPC) quando não há partida agendada.

create or replace function generate_next_match(p_team_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id        uuid;
  v_opponent_id     uuid;
  v_opponent_name   text;
  v_opponent_rating integer;
  v_maps            text[] := array['Mirage','Inferno','Nuke','Ancient','Anubis','Vertigo','Dust2'];
  v_types           text[] := array['Liga','Liga','Liga','Torneio','Scrim','Final'];
  v_map             text;
  v_type            text;
begin
  -- Se já existe uma partida agendada para este time, não cria outra
  if exists (
    select 1 from matches
    where team_id = p_team_id
      and status  = 'scheduled'
  ) then
    return null;
  end if;

  -- Escolhe um time adversário aleatório (outro usuário, onboarded)
  select
    t.id,
    t.name,
    coalesce(
      (select round(avg(p.rating))::integer
       from players p
       where p.team_id = t.id),
      60
    )
  into v_opponent_id, v_opponent_name, v_opponent_rating
  from teams t
  where t.id       != p_team_id
    and t.onboarded = true
  order by random()
  limit 1;

  -- Fallback: nenhum outro time cadastrado → adversário bot
  if v_opponent_name is null then
    v_opponent_name   := 'Team CPU';
    v_opponent_rating := 60 + floor(random() * 30)::integer;
  end if;

  -- Sorteia mapa e tipo
  v_map  := v_maps [1 + floor(random() * array_length(v_maps,  1))::int];
  v_type := v_types[1 + floor(random() * array_length(v_types, 1))::int];

  insert into matches (
    team_id, opponent_team_id, opponent_name, opponent_rating,
    scheduled_for, map, match_type, status
  ) values (
    p_team_id,
    v_opponent_id,
    v_opponent_name,
    v_opponent_rating,
    now() + interval '1 day',
    v_map,
    v_type,
    'scheduled'
  )
  returning id into v_match_id;

  return v_match_id;
end;
$$;

-- Permissão para usuários autenticados chamarem via RPC
grant execute on function generate_next_match(uuid) to authenticated;
