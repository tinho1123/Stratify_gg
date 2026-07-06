-- Migration 040: Sistema de conquistas
-- Run this AFTER migration 039
--
-- Diferente da maioria das RPCs de economia deste projeto, aqui não há uma ação única que
-- "dispara" a conquista (vitória pode vir de partida normal, torneio ou desafio; tier pode subir
-- em qualquer resolve_match). Em vez de editar todas essas funções, `check_achievements()`
-- recalcula o progresso a partir do estado que já existe (`teams.wins`, `teams.pdl`,
-- `tournament_matches`, `team_challenges`) e é chamada de forma oportunista pelo client (mesmo
-- padrão "lazy-cron" de `check_expired_contracts` etc.) — a mais natural é a cada abertura do
-- Dashboard.
--
-- Recompensa desbloqueada usa os mesmos mecanismos já existentes: créditos premium ou um
-- cosmético exclusivo (nunca vendido na loja — `cosmetics.source = 'achievement'`, mesmo
-- tratamento que os exclusivos do Season Pass). Desbloquear também insere uma notificação, que
-- já vira push de verdade via o pipeline configurado nas migrations 036-038.

alter table cosmetics drop constraint if exists cosmetics_source_check;
alter table cosmetics add constraint cosmetics_source_check
  check (source in ('shop', 'season_pass', 'achievement'));

insert into cosmetics (key, category, name, description, price_credits, preview, source) values
  ('frame_centurion', 'player_frame', 'Moldura Centurião', 'Conquista: 100 vitórias.', 9999, '{"color": "#EF4444"}', 'achievement'),
  ('name_legend',     'name_color',   'Nome Lendário',     'Conquista: Grão-Mestre.', 9999, '{"color": "#FBBF24"}', 'achievement'),
  ('frame_champion',  'player_frame', 'Moldura de Campeão','Conquista: título de torneio.', 9999, '{"color": "#A855F7"}', 'achievement')
on conflict (key) do nothing;

create table if not exists achievements (
  key               text primary key,
  category          text not null check (category in ('wins','tier','tournament','challenge')),
  name              text not null,
  description       text not null,
  requirement_type  text not null check (requirement_type in ('wins_total','pdl_reached','tournament_titles','challenge_wins')),
  requirement_value integer not null,
  reward            jsonb not null, -- {"type":"credits","amount":n} | {"type":"cosmetic","cosmetic_id":uuid}
  sort_order        integer not null default 0
);

alter table achievements enable row level security;

create policy "Anyone authenticated can view achievements"
  on achievements for select
  to authenticated
  using (true);

insert into achievements (key, category, name, description, requirement_type, requirement_value, reward, sort_order) values
  ('first_win',   'wins', 'Primeira Vitória',  'Vença sua primeira partida.',        'wins_total', 1,   jsonb_build_object('type','credits','amount',100), 1),
  ('wins_10',     'wins', 'Veterano',          'Vença 10 partidas.',                 'wins_total', 10,  jsonb_build_object('type','credits','amount',200), 2),
  ('wins_50',     'wins', 'Consistente',       'Vença 50 partidas.',                 'wins_total', 50,  jsonb_build_object('type','credits','amount',400), 3),
  ('wins_100',    'wins', 'Centurião',         'Vença 100 partidas.',                'wins_total', 100, jsonb_build_object('type','cosmetic','cosmetic_id', (select id from cosmetics where key = 'frame_centurion')), 4),
  ('reach_prata',       'tier', 'Prata',        'Alcance o elo Prata.',        'pdl_reached', 300,  jsonb_build_object('type','credits','amount',100), 10),
  ('reach_ouro',        'tier', 'Ouro',         'Alcance o elo Ouro.',         'pdl_reached', 600,  jsonb_build_object('type','credits','amount',200), 11),
  ('reach_platina',     'tier', 'Platina',      'Alcance o elo Platina.',      'pdl_reached', 900,  jsonb_build_object('type','credits','amount',300), 12),
  ('reach_diamante',    'tier', 'Diamante',     'Alcance o elo Diamante.',     'pdl_reached', 1200, jsonb_build_object('type','credits','amount',400), 13),
  ('reach_mestre',      'tier', 'Mestre',       'Alcance o elo Mestre.',       'pdl_reached', 1500, jsonb_build_object('type','credits','amount',500), 14),
  ('reach_grao_mestre', 'tier', 'Grão-Mestre',  'Alcance o elo Grão-Mestre.',  'pdl_reached', 1800, jsonb_build_object('type','cosmetic','cosmetic_id', (select id from cosmetics where key = 'name_legend')), 15),
  ('tournament_champion', 'tournament', 'Campeão de Torneio', 'Vença um torneio especial.', 'tournament_titles', 1, jsonb_build_object('type','cosmetic','cosmetic_id', (select id from cosmetics where key = 'frame_champion')), 20),
  ('challenge_wins_5',    'challenge',  'Rival Respeitado',   'Vença 5 desafios.',          'challenge_wins',    5, jsonb_build_object('type','credits','amount',150), 30)
on conflict (key) do nothing;

create table if not exists team_achievements (
  team_id         uuid not null references teams(id) on delete cascade,
  achievement_key text not null references achievements(key),
  unlocked_at     timestamptz not null default now(),
  primary key (team_id, achievement_key)
);

alter table team_achievements enable row level security;

create policy "Users can view their own team's achievements"
  on team_achievements for select
  to authenticated
  using (team_id in (select id from teams where user_id = auth.uid()));

-- Sem policy de insert/update/delete -> só check_achievements() escreve aqui.

-- ── check_achievements(): recalcula progresso e desbloqueia o que já foi atingido ───────────
create or replace function check_achievements()
returns setof team_achievements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team        teams%rowtype;
  v_achievement achievements%rowtype;
  v_progress    integer;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  for v_achievement in select * from achievements order by sort_order loop
    if exists (
      select 1 from team_achievements
      where team_id = v_team.id and achievement_key = v_achievement.key
    ) then
      continue;
    end if;

    v_progress := case v_achievement.requirement_type
      when 'wins_total'  then v_team.wins
      when 'pdl_reached' then v_team.pdl
      when 'tournament_titles' then (
        select count(*)::integer from tournament_matches tm
          join tournaments t on t.id = tm.tournament_id
          where tm.winner_team_id = v_team.id
            and tm.round = round(log(2, t.bracket_size))::integer
      )
      when 'challenge_wins' then (
        select count(*)::integer from team_challenges where winner_team_id = v_team.id
      )
      else 0
    end;

    if v_progress >= v_achievement.requirement_value then
      insert into team_achievements (team_id, achievement_key) values (v_team.id, v_achievement.key);

      if (v_achievement.reward ->> 'type') = 'credits' then
        update teams set premium_credits = premium_credits + (v_achievement.reward ->> 'amount')::integer
          where id = v_team.id;
      elsif (v_achievement.reward ->> 'type') = 'cosmetic' then
        insert into team_cosmetics (team_id, cosmetic_id)
          values (v_team.id, (v_achievement.reward ->> 'cosmetic_id')::uuid)
          on conflict (team_id, cosmetic_id) do nothing;
      end if;

      insert into notifications (user_id, type, tag, message)
      values (auth.uid(), 'success', 'CONQUISTA', v_achievement.name || ' desbloqueada!');
    end if;
  end loop;

  return query select * from team_achievements where team_id = v_team.id;
end;
$$;

grant execute on function check_achievements() to authenticated;
