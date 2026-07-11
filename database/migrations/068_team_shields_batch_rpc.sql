-- Migration 068: RPC em lote pra expor o escudo (cosméticos equipados) de outros times
-- Run this AFTER migration 067
--
-- `teams` só é legível pelo próprio dono via RLS (migration 006) — o client não pode montar o
-- escudo de um time adversário com um select direto em `teams.equipped_cosmetics` + join em
-- `cosmetics`. `get_teams_shields` é uma função SECURITY DEFINER que devolve só os 4 valores já
-- resolvidos (shape/icon ref + primary/secondary color), igual ao padrão de
-- `get_team_public_profile` (migration 045) pra name_color/frame_color — nunca os IDs de
-- cosmético, então o client não aprende o catálogo de outro time.
--
-- Em lote (aceita um array de team_id) porque telas de partida/desafio geralmente precisam do
-- escudo de vários adversários de uma vez (histórico de partidas, lista de rivais, desafios) —
-- uma chamada só em vez de N.
--
-- Times sem os 4 slots de escudo equipados (ex.: nunca abriram o editor de escudo) voltam com os
-- 4 campos null — o client trata isso como "sem escudo" e cai num fallback genérico.

create or replace function get_teams_shields(p_team_ids uuid[])
returns table (
  team_id         uuid,
  shape_ref       text,
  icon_ref        text,
  primary_color   text,
  secondary_color text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.id,
    sc_shape.preview->>'ref'      as shape_ref,
    sc_icon.preview->>'ref'       as icon_ref,
    sc_primary.preview->>'color'  as primary_color,
    sc_secondary.preview->>'color' as secondary_color
  from teams t
  left join cosmetics sc_shape     on sc_shape.id     = nullif(t.equipped_cosmetics->>'shield_shape', '')::uuid
  left join cosmetics sc_icon      on sc_icon.id      = nullif(t.equipped_cosmetics->>'shield_icon', '')::uuid
  left join cosmetics sc_primary   on sc_primary.id   = nullif(t.equipped_cosmetics->>'shield_primary_color', '')::uuid
  left join cosmetics sc_secondary on sc_secondary.id = nullif(t.equipped_cosmetics->>'shield_secondary_color', '')::uuid
  where t.id = any(p_team_ids);
$$;

grant execute on function get_teams_shields(uuid[]) to authenticated;
