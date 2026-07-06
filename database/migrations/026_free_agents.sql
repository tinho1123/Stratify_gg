-- Migration 026: Agentes livres (contratar sem custo quando o elenco está incompleto)
-- Run this AFTER migration 025
--
-- Motivação: se os contratos vencem (023) e o time fica sem jogadores suficientes, e o
-- usuário não tem orçamento pra comprar no mercado, ele fica travado sem conseguir montar
-- time. `sign_free_agent()` deixa contratar um jogador amador de graça enquanto o elenco
-- tiver menos de 5 jogadores.
--
-- De caminho, fecha outra brecha: a criação do elenco inicial (`generateStarterPlayers.ts`)
-- fazia INSERT direto em `players` a partir do client, calculando rating/salário no app —
-- sem nenhuma policy que restrinja quantidade ou valores. Um client malicioso podia chamar
-- isso repetidas vezes (ou um INSERT cru via REST) e criar jogadores de graça com stats no
-- máximo. Revoga INSERT direto e move a geração pro servidor (mesmo padrão de 023).

revoke insert on players from authenticated;

-- Gera um jogador amador (rating baixo) pro time, com skills aleatórias fracas.
create or replace function generate_rookie_player(p_team_id uuid, p_user_id uuid, p_role text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_rating    integer;
  v_salary    integer;
  v_age       integer;
  v_names     text[] := array[
    'Shadow','Viper','Ghost','Reaper','Phantom','Storm','Blade','Nova',
    'Raven','Cipher','Frost','Blaze','Echo','Jinx','Specter'
  ];
  v_name      text;
begin
  v_rating := 20 + floor(random() * 33)::int;   -- 20-52, faixa "amador"
  v_salary := 1500 + floor(random() * 2500)::int;
  v_age    := 17 + floor(random() * 5)::int;
  v_name   := v_names[1 + floor(random() * array_length(v_names, 1))::int];

  insert into players (
    user_id, team_id, name, role, status, rating, salary,
    contract_end, age, energy, morale, form, kills, deaths, assists, adr
  ) values (
    p_user_id, p_team_id, v_name, p_role, 'online', v_rating, v_salary,
    now() + interval '15 days', v_age, 100, 100, 50 + floor(random() * 36)::int,
    0, 0, 0, 0
  )
  returning id into v_player_id;

  insert into player_skills (player_id, skill_id, value)
  select v_player_id, s.id, 20 + floor(random() * 31)::int
  from skills s;

  return v_player_id;
end;
$$;

-- Chamada uma vez na criação do time (substitui o insert direto do client).
create or replace function generate_starter_players()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team  teams%rowtype;
  v_role  text;
  v_roles text[] := array['IGL','AWPer','Support','Entry','Flex'];
begin
  select t.* into v_team from teams t where t.user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  if exists (select 1 from players where team_id = v_team.id) then
    return; -- já tem elenco, não duplica
  end if;

  foreach v_role in array v_roles loop
    perform generate_rookie_player(v_team.id, auth.uid(), v_role);
  end loop;
end;
$$;

grant execute on function generate_starter_players() to authenticated;

-- Contratação gratuita de agente livre — só permitida com elenco incompleto (<5).
create or replace function sign_free_agent(p_role text)
returns players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team      teams%rowtype;
  v_count     integer;
  v_player_id uuid;
  v_player    players%rowtype;
begin
  select t.* into v_team from teams t where t.user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select count(*) into v_count from players where team_id = v_team.id;
  if v_count >= 5 then
    raise exception 'roster_full';
  end if;

  if p_role not in ('IGL','AWPer','Support','Entry','Flex') then
    raise exception 'invalid_role';
  end if;

  v_player_id := generate_rookie_player(v_team.id, auth.uid(), p_role);
  select * into v_player from players where id = v_player_id;
  return v_player;
end;
$$;

grant execute on function sign_free_agent(text) to authenticated;
