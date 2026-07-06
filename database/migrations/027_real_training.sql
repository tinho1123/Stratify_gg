-- Migration 027: Treino de verdade (hoje é só UI local, não muda nenhum atributo)
-- Run this AFTER migration 026
--
-- O treino inteiro rodava em AsyncStorage no aparelho — terminar uma sessão nunca alterou
-- nenhum skill do jogador, e o estado nem sincronizava entre dispositivos. Esta migration move
-- a sessão de treino pro servidor (colunas em `players`) e aplica os bônus de verdade em
-- `player_skills` quando a sessão termina.
--
-- Como energia nunca foi consumida por nada até agora, adicionar custo de treino sem
-- regeneração deixaria o jogador travado pra sempre depois de algumas sessões — por isso
-- também entra regeneração passiva (+5 energia/hora, até 100), aplicada de forma preguiçosa
-- (mesmo padrão de tudo nesse projeto: recalculada quando alguém chama as funções abaixo).

alter table players
  add column if not exists training_type     text,
  add column if not exists training_ends_at  timestamptz,
  add column if not exists energy_updated_at timestamptz not null default now();

-- Consumida/testada dentro das funções abaixo — não precisa ser pública.
create or replace function regen_energy_for_team(p_team_id uuid)
returns void
language sql
as $$
  update players set
    energy = least(100, energy + floor(extract(epoch from (now() - energy_updated_at)) / 3600 * 5)::int),
    energy_updated_at = energy_updated_at
      + (floor(extract(epoch from (now() - energy_updated_at)) / 3600)::int * interval '1 hour')
  where team_id = p_team_id and energy < 100;
$$;

-- Inicia uma sessão de treino: valida energia, bloqueia se outro jogador do time já está
-- treinando (mesma trava que a UI antiga só fazia localmente), deduz energia na hora.
create or replace function start_training(p_player_id uuid, p_training_type text)
returns players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team   teams%rowtype;
  v_player players%rowtype;
  v_cost   integer;
begin
  select t.* into v_team from teams t where t.user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  v_cost := case p_training_type
    when 'aim'           then 20
    when 'strategy'      then 15
    when 'clutch'        then 25
    when 'spray'         then 18
    when 'movement'      then 20
    when 'team_practice' then 30
    else null
  end;
  if v_cost is null then
    raise exception 'invalid_training_type';
  end if;

  if exists (
    select 1 from players
    where team_id = v_team.id and training_ends_at is not null and training_ends_at > now()
  ) then
    raise exception 'team_already_training';
  end if;

  perform regen_energy_for_team(v_team.id);

  select * into v_player from players
    where id = p_player_id and team_id = v_team.id
    for update;
  if not found then
    raise exception 'player_not_found';
  end if;

  if v_player.status <> 'online' then
    raise exception 'player_unavailable';
  end if;

  if v_player.energy < v_cost then
    raise exception 'insufficient_energy';
  end if;

  update players set
    energy            = energy - v_cost,
    training_type     = p_training_type,
    training_ends_at  = now() + interval '2 hours'
  where id = p_player_id
  returning * into v_player;

  return v_player;
end;
$$;

grant execute on function start_training(uuid, text) to authenticated;

-- Cancela a sessão em andamento (sem reembolso de energia).
create or replace function cancel_training(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team teams%rowtype;
begin
  select t.* into v_team from teams t where t.user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  update players set training_type = null, training_ends_at = null
  where id = p_player_id and team_id = v_team.id;
end;
$$;

grant execute on function cancel_training(uuid) to authenticated;

-- Sob demanda (chamada ao abrir a tela de treino/elenco): regenera energia do time inteiro e
-- aplica o bônus de skill de qualquer sessão de treino já concluída.
create or replace function claim_completed_training()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team    teams%rowtype;
  v_player  record;
  v_deltas  jsonb;
  v_key     text;
  v_val     integer;
begin
  select t.* into v_team from teams t where t.user_id = auth.uid();
  if not found then
    return;
  end if;

  perform regen_energy_for_team(v_team.id);

  for v_player in
    select id, name, training_type from players
    where team_id = v_team.id
      and training_ends_at is not null
      and training_ends_at <= now()
  loop
    v_deltas := case v_player.training_type
      when 'aim'           then '{"aim":5,"precisao":4}'::jsonb
      when 'strategy'      then '{"leitura":6,"decisao":4}'::jsonb
      when 'clutch'        then '{"decisao":5,"awareness":4}'::jsonb
      when 'spray'         then '{"recoil_control":6,"tracking":3}'::jsonb
      when 'movement'      then '{"movimentacao":5,"strafing":4,"peek":3}'::jsonb
      when 'team_practice' then '{"comunicacao":5,"teamplay":5}'::jsonb
      else '{}'::jsonb
    end;

    for v_key in select jsonb_object_keys(v_deltas) loop
      v_val := (v_deltas ->> v_key)::integer;
      update player_skills ps
        set value = least(100, ps.value + v_val)
        from skills s
        where ps.skill_id = s.id
          and ps.player_id = v_player.id
          and s.name = v_key;
    end loop;

    insert into notifications (user_id, type, tag, message)
    values (
      auth.uid(), 'success', 'TREINO',
      v_player.name || ' concluiu o treino e melhorou seus atributos!'
    );

    update players set training_type = null, training_ends_at = null where id = v_player.id;
  end loop;
end;
$$;

grant execute on function claim_completed_training() to authenticated;
