-- Migration 025: Aviso ANTES do contrato vencer (não só depois que o jogador já saiu)
-- Run this AFTER migration 024
--
-- `check_expired_contracts` (023) só notifica DEPOIS que o jogador já foi removido — não dá
-- tempo de renovar. `check_expiring_contracts` roda junto (sob demanda, mesmo padrão) e avisa
-- com antecedência quando o contrato está a ≤3 dias de vencer, uma única vez por jogador
-- (dedup via `related_id`).

create or replace function check_expiring_contracts()
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
    select id, name, contract_end from players
    where team_id = v_team.id
      and contract_end > now()
      and contract_end <= now() + interval '3 days'
  loop
    insert into notifications (user_id, type, tag, message, related_id)
    select
      auth.uid(), 'alert', 'CONTRATO',
      v_player.name || ' — contrato vence em ' || to_char(v_player.contract_end, 'DD/MM') ||
        '. Renove antes que ele saia do time.',
      v_player.id
    where not exists (
      select 1 from notifications
      where user_id = auth.uid() and related_id = v_player.id and tag = 'CONTRATO'
    );
  end loop;
end;
$$;

grant execute on function check_expiring_contracts() to authenticated;
