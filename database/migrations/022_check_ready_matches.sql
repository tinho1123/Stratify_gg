-- Migration 022: Notificação quando a partida agendada fica pronta pra assistir
-- Run this AFTER migration 021
--
-- Sem cron: chamada sob demanda pelo client (dashboard, a cada 60s enquanto a tela estiver
-- aberta, e ao entrar em Partidas), mesmo padrão de `generate_next_match`/`get_or_create_season`.
-- Só olha as partidas do PRÓPRIO time do chamador — não precisa (nem deve) varrer todo mundo.
--
-- `related_id` é uma coluna genérica pra ligar a notificação a uma entidade (aqui, o id da
-- partida) sem sujar `tag` — que continua curto pra exibição na pill da UI — e serve de chave
-- de dedup (não insere de novo se já existe notificação com esse related_id pra esse usuário).

alter table notifications
  add column if not exists related_id uuid;

create index if not exists idx_notifications_related_id
  on notifications (user_id, related_id);

create or replace function check_ready_matches()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team  teams%rowtype;
  v_match record;
begin
  select t.* into v_team from teams t where t.user_id = auth.uid();
  if not found then
    return;
  end if;

  for v_match in
    select id, opponent_name from matches
    where team_id = v_team.id
      and status = 'scheduled'
      and scheduled_for <= now()
  loop
    insert into notifications (user_id, type, tag, message, related_id)
    select auth.uid(), 'success', 'PARTIDA',
           'Sua partida contra ' || v_match.opponent_name || ' está pronta! Toque para assistir.',
           v_match.id
    where not exists (
      select 1 from notifications
      where user_id = auth.uid() and related_id = v_match.id
    );
  end loop;
end;
$$;

grant execute on function check_ready_matches() to authenticated;
