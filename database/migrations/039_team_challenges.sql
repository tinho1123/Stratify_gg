-- Migration 039: Desafios diretos entre times reais do mesmo elo
-- Run this AFTER migration 038
--
-- Complementa a liga e os torneios com uma partida amistosa avulsa: qualquer time pode desafiar
-- outro do mesmo elo (visível na classificação da liga), o desafiado aceita ou recusa, e — se
-- aceito — a partida é resolvida como as de torneio: ambos os lados são times reais, o resultado
-- usa o rating ao vivo dos dois, e quem chamar `resolve_challenge_match` primeiro decide (é
-- idempotente pro outro lado).
--
-- Recompensa é pequena e fixa (só fãs, sem budget/pdl) e limitada por cooldown — sem isso, dois
-- times combinados poderiam se desafiar em loop pra farmar economia sem o ritmo natural das
-- partidas normais (energia, contrato, lesão).

create table if not exists team_challenges (
  id                  uuid primary key default gen_random_uuid(),
  challenger_team_id  uuid not null references teams(id) on delete cascade,
  challenger_name     text not null,
  opponent_team_id    uuid not null references teams(id) on delete cascade,
  opponent_name       text not null,
  status              text not null default 'pending'
                        check (status in ('pending','accepted','declined','expired','played')),
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default now() + interval '48 hours',
  scheduled_for       timestamptz,
  score_challenger    integer,
  score_opponent      integer,
  winner_team_id      uuid references teams(id),
  played_at           timestamptz
);

alter table team_challenges enable row level security;

create policy "Users can view challenges involving their own team"
  on team_challenges for select
  to authenticated
  using (
    challenger_team_id in (select id from teams where user_id = auth.uid())
    or opponent_team_id in (select id from teams where user_id = auth.uid())
  );

-- Sem policy de insert/update/delete -> só as funções SECURITY DEFINER abaixo escrevem aqui.

create index if not exists team_challenges_challenger_idx on team_challenges (challenger_team_id, status);
create index if not exists team_challenges_opponent_idx   on team_challenges (opponent_team_id, status);

alter table teams add column if not exists last_challenge_reward_at timestamptz;

-- ── send_challenge(): desafia outro time do mesmo elo ───────────────────────────────────────
create or replace function send_challenge(p_opponent_team_id uuid)
returns team_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team     teams%rowtype;
  v_opponent teams%rowtype;
  v_row      team_challenges%rowtype;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  if p_opponent_team_id = v_team.id then
    raise exception 'cannot_challenge_self';
  end if;

  select * into v_opponent from teams where id = p_opponent_team_id;
  if not found then
    raise exception 'opponent_not_found';
  end if;

  if tier_for_pdl(v_team.pdl) <> tier_for_pdl(v_opponent.pdl) then
    raise exception 'wrong_tier';
  end if;

  -- Expira (best-effort) desafios pendentes vencidos antes de checar duplicidade.
  update team_challenges set status = 'expired'
    where status = 'pending' and expires_at <= now();

  if exists (
    select 1 from team_challenges
    where status = 'pending'
      and ((challenger_team_id = v_team.id and opponent_team_id = p_opponent_team_id)
        or (challenger_team_id = p_opponent_team_id and opponent_team_id = v_team.id))
  ) then
    raise exception 'challenge_already_pending';
  end if;

  insert into team_challenges (challenger_team_id, challenger_name, opponent_team_id, opponent_name)
  values (v_team.id, v_team.name, p_opponent_team_id, v_opponent.name)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function send_challenge(uuid) to authenticated;

-- ── respond_to_challenge(): o desafiado aceita ou recusa ────────────────────────────────────
create or replace function respond_to_challenge(p_challenge_id uuid, p_accept boolean)
returns team_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_row     team_challenges%rowtype;
begin
  select id into v_team_id from teams where user_id = auth.uid();
  if v_team_id is null then
    raise exception 'team_not_found';
  end if;

  select * into v_row from team_challenges where id = p_challenge_id for update;
  if not found then
    raise exception 'challenge_not_found';
  end if;

  if v_row.opponent_team_id <> v_team_id then
    raise exception 'not_your_challenge';
  end if;

  if v_row.status <> 'pending' or v_row.expires_at <= now() then
    raise exception 'challenge_not_pending';
  end if;

  update team_challenges set
    status = case when p_accept then 'accepted' else 'declined' end,
    scheduled_for = case when p_accept then now() + interval '1 hour' else null end
  where id = p_challenge_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function respond_to_challenge(uuid, boolean) to authenticated;

-- ── resolve_challenge_match(): idempotente, chamável por qualquer um dos dois lados ─────────
create or replace function resolve_challenge_match(p_challenge_id uuid)
returns team_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row      team_challenges%rowtype;
  v_team_id  uuid;
  v_a_avg    numeric;
  v_b_avg    numeric;
  v_prob     numeric;
  v_a_won    boolean;
  v_score_a  integer;
  v_score_b  integer;
  v_winner   uuid;
  v_last_reward timestamptz;
begin
  select id into v_team_id from teams where user_id = auth.uid();
  if v_team_id is null then
    raise exception 'team_not_found';
  end if;

  select * into v_row from team_challenges where id = p_challenge_id for update;
  if not found then
    raise exception 'challenge_not_found';
  end if;

  if v_team_id not in (v_row.challenger_team_id, v_row.opponent_team_id) then
    raise exception 'not_your_challenge';
  end if;

  if v_row.status = 'played' then
    return v_row; -- idempotente
  end if;

  if v_row.status <> 'accepted' then
    raise exception 'challenge_not_ready';
  end if;

  if v_row.scheduled_for > now() then
    raise exception 'challenge_not_ready';
  end if;

  select coalesce(avg(rating), 65) into v_a_avg from players where team_id = v_row.challenger_team_id and status = 'online';
  select coalesce(avg(rating), 65) into v_b_avg from players where team_id = v_row.opponent_team_id and status = 'online';

  v_prob := greatest(0.12, least(0.88, 0.5 + (v_a_avg - v_b_avg) / 80.0));
  v_a_won := random() < v_prob;

  v_score_a := case when v_a_won then 16 else 3 + floor(random() * 12)::int end;
  v_score_b := case when v_a_won then 3 + floor(random() * 12)::int else 16 end;
  v_winner  := case when v_a_won then v_row.challenger_team_id else v_row.opponent_team_id end;

  update team_challenges set
    status = 'played', score_challenger = v_score_a, score_opponent = v_score_b,
    winner_team_id = v_winner, played_at = now()
  where id = p_challenge_id
  returning * into v_row;

  -- Recompensa pequena e fixa pro vencedor, com cooldown de 4h por time (mesmo espírito do
  -- anúncio recompensado) pra não virar farm de economia entre dois times combinados.
  select last_challenge_reward_at into v_last_reward from teams where id = v_winner;
  if v_last_reward is null or v_last_reward <= now() - interval '4 hours' then
    update teams set fans = fans + 150, last_challenge_reward_at = now() where id = v_winner;
  end if;

  return v_row;
end;
$$;

grant execute on function resolve_challenge_match(uuid) to authenticated;
