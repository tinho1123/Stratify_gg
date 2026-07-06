-- Migration 045: Perfil público de time (elenco, elo, cosméticos e conquistas de qualquer time)
-- Run this AFTER migration 044
--
-- `teams`, `players` e `team_achievements` só são legíveis pelo próprio dono via RLS (migrations
-- 006, 003, 040) — não dá pra montar um perfil público de outro time com selects diretos do
-- client. `get_team_public_profile` é uma função SECURITY DEFINER que devolve só os campos
-- pensados pra exibição pública: nome do time, elo (pdl), vitórias/derrotas, fãs, as cores dos
-- cosméticos equipados (não os IDs — o client nunca aprende quais cosméticos existem pra outro
-- time, só a cor já resolvida) e um resumo do elenco (nome, função, rating, status — sem salário,
-- energia, moral, contrato ou K/D/A, que continuam privados/de gestão interna) e das conquistas
-- desbloqueadas (chave, nome, categoria — sem os valores de requisito).
--
-- `p_team_id` vem do client (ex.: ao tocar num time no ranking ou no chat) — qualquer autenticado
-- pode consultar o perfil de qualquer outro time, isso é o objetivo da feature.

create or replace function get_team_public_profile(p_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team         teams%rowtype;
  v_name_color   text;
  v_frame_color  text;
  v_roster       jsonb;
  v_achievements jsonb;
begin
  select * into v_team from teams where id = p_team_id;
  if not found then
    raise exception 'team_not_found';
  end if;

  select c.preview->>'color' into v_name_color
    from cosmetics c where c.id = nullif(v_team.equipped_cosmetics->>'name_color', '')::uuid;

  select c.preview->>'color' into v_frame_color
    from cosmetics c where c.id = nullif(v_team.equipped_cosmetics->>'player_frame', '')::uuid;

  select coalesce(jsonb_agg(
      jsonb_build_object('name', p.name, 'role', p.role, 'rating', p.rating, 'status', p.status)
      order by p.rating desc
    ), '[]'::jsonb)
    into v_roster
    from players p
    where p.team_id = p_team_id;

  select coalesce(jsonb_agg(
      jsonb_build_object('key', a.key, 'name', a.name, 'category', a.category)
      order by a.sort_order
    ), '[]'::jsonb)
    into v_achievements
    from team_achievements ta
    join achievements a on a.key = ta.achievement_key
    where ta.team_id = p_team_id;

  return jsonb_build_object(
    'team_id',      v_team.id,
    'team_name',    v_team.name,
    'pdl',          v_team.pdl,
    'wins',         v_team.wins,
    'losses',       v_team.losses,
    'fans',         v_team.fans,
    'name_color',   v_name_color,
    'frame_color',  v_frame_color,
    'roster',       v_roster,
    'achievements', v_achievements
  );
end;
$$;

grant execute on function get_team_public_profile(uuid) to authenticated;
