-- Migration 023: Expiração e renovação de contrato de jogador
-- Run this AFTER migration 022
--
-- Hoje `contract_end` é só exibido, nunca expira e nunca pode ser renovado — o elenco nunca
-- muda organicamente. Esta migration adiciona:
--   1. `check_expired_contracts()` — sob demanda pelo client (mesmo padrão de
--      `check_ready_matches`), remove do time jogadores cujo contrato já venceu e notifica.
--   2. `renew_contract(p_player_id, p_months)` — estende o contrato cobrando salário * meses
--      do orçamento do time.
--
-- Também fecha uma lacuna descoberta ao revisar este fluxo: a policy de UPDATE de `players`
-- (migration 003) só verifica dono, sem restringir colunas — o client conseguia hoje escrever
-- `rating`/`salary`/`contract_end`/etc. do PRÓPRIO jogador direto via REST, de graça, sem
-- nenhuma validação de custo/servidor (nenhuma tela usa isso hoje, mas a policy permitia).
-- Revoga UPDATE/DELETE diretos do client: a partir de agora só via função SECURITY DEFINER.

revoke update, delete on players from authenticated;

create or replace function check_expired_contracts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team   teams%rowtype;
  v_player record;
begin
  select t.* into v_team from teams t where t.user_id = auth.uid();
  if not found then
    return;
  end if;

  for v_player in
    select id, name from players
    where team_id = v_team.id and contract_end <= now()
  loop
    insert into notifications (user_id, type, tag, message)
    values (
      auth.uid(), 'alert', 'CONTRATO',
      v_player.name || ' saiu do time — contrato expirou sem renovação.'
    );

    delete from players where id = v_player.id;
  end loop;
end;
$$;

grant execute on function check_expired_contracts() to authenticated;

create or replace function renew_contract(p_player_id uuid, p_months integer default 6)
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

  select * into v_player from players
    where id = p_player_id and team_id = v_team.id
    for update;
  if not found then
    raise exception 'player_not_found';
  end if;

  if p_months < 1 or p_months > 24 then
    raise exception 'invalid_months';
  end if;

  if v_player.contract_end <= now() then
    raise exception 'contract_already_expired';
  end if;

  v_cost := v_player.salary * p_months;

  if v_team.budget < v_cost then
    raise exception 'insufficient_budget';
  end if;

  update teams set budget = budget - v_cost where id = v_team.id;

  update players
    set contract_end = contract_end + (p_months || ' months')::interval
    where id = p_player_id
    returning * into v_player;

  return v_player;
end;
$$;

grant execute on function renew_contract(uuid, integer) to authenticated;
