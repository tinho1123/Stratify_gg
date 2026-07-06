-- Migration 031: Salva o relatório detalhado da partida (K/D/A por jogador + histórico de rounds)
-- Run this AFTER migration 030
--
-- `resolve_match` já grava a coluna `player_stats`, mas o client só descobre o placar final
-- (score_own/score_opp) DEPOIS de chamar `resolve_match` — a simulação round a round (kills,
-- assistências, narração dos eventos) só é montada localmente em seguida, então `player_stats`
-- sempre ficava `[]`. Como esse relatório é puramente cosmético (K/D/A e narração da partida,
-- visíveis só pro dono do time — não afeta economia nem ranking, ver regra 4 do CLAUDE.md), e
-- `UPDATE` em `matches` já está totalmente bloqueado pra `authenticated` (migration 017),
-- criamos uma função dedicada só pra essa coluna, sem tocar em nenhum campo de economia.

create or replace function save_match_report(p_match_id uuid, p_report jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update matches
    set player_stats = p_report
    where id = p_match_id
      and status = 'played'
      and team_id in (select id from teams where user_id = auth.uid());
end;
$$;

grant execute on function save_match_report(uuid, jsonb) to authenticated;
