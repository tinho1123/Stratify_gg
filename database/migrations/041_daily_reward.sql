-- Migration 041: Recompensa diária de login (streak de 7 dias)
-- Run this AFTER migration 040
--
-- Mecânica simples de retenção: uma vez por dia (fuso do servidor), o time reivindica créditos
-- premium crescentes conforme o streak, com um bônus maior no dia 7 antes de reiniciar o ciclo.
-- Quebrar o streak (pular um dia) reseta pro dia 1 — por isso usa `current_date` (não
-- timestamptz) pra comparar "mesmo dia"/"dia seguinte" sem depender de horário exato.

alter table teams add column if not exists login_streak_count integer not null default 0;
alter table teams add column if not exists last_login_reward_at date;

create or replace function claim_daily_reward()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team         teams%rowtype;
  v_today        constant date := current_date;
  v_new_streak   integer;
  v_day_in_cycle integer;
  v_credits      integer;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  if v_team.last_login_reward_at = v_today then
    raise exception 'already_claimed_today';
  end if;

  if v_team.last_login_reward_at = v_today - 1 then
    v_new_streak := v_team.login_streak_count + 1;
  else
    v_new_streak := 1;
  end if;

  v_day_in_cycle := ((v_new_streak - 1) % 7) + 1;
  v_credits := case when v_day_in_cycle = 7 then 100 else 15 + v_day_in_cycle * 5 end;

  update teams set
    premium_credits = premium_credits + v_credits,
    login_streak_count = v_new_streak,
    last_login_reward_at = v_today
  where id = v_team.id;

  return jsonb_build_object('streak', v_new_streak, 'day_in_cycle', v_day_in_cycle, 'credits_granted', v_credits);
end;
$$;

grant execute on function claim_daily_reward() to authenticated;
