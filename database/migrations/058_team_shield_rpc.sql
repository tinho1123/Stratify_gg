-- Migration 058: equip_team_shield() — equipagem atômica das 4 peças do escudo de time
-- Run this AFTER migration 057
--
-- Em vez de 4 chamadas sequenciais a equip_cosmetic (uma por categoria), uma RPC única que
-- valida os 4 ids de uma vez (categoria certa em cada slot + posse em team_cosmetics) e escreve
-- as 4 chaves atomicamente num único update — evita o escudo ficar inconsistente se uma
-- chamada falhasse no meio do caminho. Mesmo padrão de resolução de time via auth.uid() de
-- purchase_cosmetic/equip_cosmetic (migration 032).

create or replace function equip_team_shield(
  p_shape_id           uuid,
  p_primary_color_id   uuid,
  p_secondary_color_id uuid,
  p_icon_id            uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  select id into v_team_id from teams where user_id = auth.uid();
  if v_team_id is null then
    raise exception 'team_not_found';
  end if;

  perform 1 from cosmetics where id = p_shape_id and category = 'shield_shape' and is_active;
  if not found then
    raise exception 'invalid_shape';
  end if;

  perform 1 from cosmetics where id = p_primary_color_id and category = 'shield_primary_color' and is_active;
  if not found then
    raise exception 'invalid_primary_color';
  end if;

  perform 1 from cosmetics where id = p_secondary_color_id and category = 'shield_secondary_color' and is_active;
  if not found then
    raise exception 'invalid_secondary_color';
  end if;

  perform 1 from cosmetics where id = p_icon_id and category = 'shield_icon' and is_active;
  if not found then
    raise exception 'invalid_icon';
  end if;

  if (
    select count(*) from team_cosmetics
    where team_id = v_team_id
      and cosmetic_id in (p_shape_id, p_primary_color_id, p_secondary_color_id, p_icon_id)
  ) <> 4 then
    raise exception 'not_owned';
  end if;

  update teams set equipped_cosmetics = equipped_cosmetics || jsonb_build_object(
      'shield_shape',           p_shape_id::text,
      'shield_primary_color',   p_primary_color_id::text,
      'shield_secondary_color', p_secondary_color_id::text,
      'shield_icon',            p_icon_id::text
    )
    where id = v_team_id;
end;
$$;

grant execute on function equip_team_shield(uuid, uuid, uuid, uuid) to authenticated;
