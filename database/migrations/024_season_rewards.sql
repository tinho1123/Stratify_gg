-- Migration 024: Recompensa ao fim da temporada da liga
-- Run this AFTER migration 023
--
-- Hoje a classificação da temporada (`season_standings`) só fica parada quando a temporada
-- vira — não há nenhum prêmio pelo resultado final. `claim_season_rewards()` roda sob demanda
-- (dashboard e tela da liga) e paga bônus de orçamento/fãs pro time que ficou entre os 3
-- primeiros de uma temporada já encerrada, uma única vez por temporada (via
-- `reward_claimed`).

alter table season_standings
  add column if not exists reward_claimed boolean not null default false;

create or replace function claim_season_rewards()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team         teams%rowtype;
  v_row          record;
  v_rank         integer;
  v_budget_bonus integer;
  v_fans_bonus   integer;
begin
  select t.* into v_team from teams t where t.user_id = auth.uid();
  if not found then
    return;
  end if;

  for v_row in
    select ss.id, ss.season_id, ss.points, ss.wins, s.tier, s.season_number
    from season_standings ss
    join seasons s on s.id = ss.season_id
    where ss.team_id = v_team.id
      and ss.reward_claimed = false
      and (s.status = 'ended' or s.ends_at <= now())
  loop
    select count(*) + 1 into v_rank
      from season_standings other
      where other.season_id = v_row.season_id
        and (
          other.points > v_row.points
          or (other.points = v_row.points and other.wins > v_row.wins)
        );

    v_budget_bonus := case v_rank when 1 then 5000 when 2 then 3000 when 3 then 1500 else 0 end;
    v_fans_bonus   := case v_rank when 1 then 1000 when 2 then 600  when 3 then 300  else 0 end;

    if v_budget_bonus > 0 or v_fans_bonus > 0 then
      update teams set
        budget = budget + v_budget_bonus,
        fans   = fans   + v_fans_bonus
      where id = v_team.id;

      insert into notifications (user_id, type, tag, message)
      values (
        auth.uid(), 'success', 'LIGA',
        'Você terminou em ' || v_rank || 'º lugar na temporada ' || v_row.season_number
          || ' (' || v_row.tier || ')! +$' || v_budget_bonus || ' e +' || v_fans_bonus || ' fãs.'
      );
    end if;

    update season_standings set reward_claimed = true where id = v_row.id;
  end loop;
end;
$$;

grant execute on function claim_season_rewards() to authenticated;
