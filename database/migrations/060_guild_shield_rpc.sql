-- Migration 060: purchase_guild_cosmetic() e equip_guild_shield()
-- Run this AFTER migration 059
--
-- Guildas não têm carteira própria — quem paga é sempre o time líder (mesmo padrão de
-- create_guild, migration 054), mesmo quando quem compra é um oficial. Só líder/oficial pode
-- comprar ou equipar peças de escudo da guilda (mesma checagem de role usada em
-- kick_member/invite_team, migration 054).

create or replace function purchase_guild_cosmetic(p_guild_id uuid, p_cosmetic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team       teams%rowtype;
  v_membership guild_members%rowtype;
  v_guild      guilds%rowtype;
  v_leader     teams%rowtype;
  v_category   text;
  v_price      integer;
  v_active     boolean;
  v_source     text;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select * into v_membership from guild_members
    where team_id = v_team.id and guild_id = p_guild_id;
  if not found or v_membership.role not in ('leader', 'officer') then
    raise exception 'not_authorized';
  end if;

  select * into v_guild from guilds where id = p_guild_id;
  if not found then
    raise exception 'guild_not_found';
  end if;

  select category, price_credits, is_active, source into v_category, v_price, v_active, v_source
    from cosmetics where id = p_cosmetic_id;
  if v_price is null then
    raise exception 'cosmetic_not_found';
  end if;
  if not v_active or v_source <> 'shop' or v_category not like 'guild_shield_%' then
    raise exception 'cosmetic_unavailable';
  end if;

  if exists (select 1 from guild_cosmetics where guild_id = p_guild_id and cosmetic_id = p_cosmetic_id) then
    raise exception 'already_owned';
  end if;

  select * into v_leader from teams where id = v_guild.leader_team_id for update;
  if not found then
    raise exception 'leader_not_found';
  end if;

  if v_leader.premium_credits < v_price then
    raise exception 'insufficient_credits';
  end if;

  update teams set premium_credits = premium_credits - v_price where id = v_leader.id;
  insert into guild_cosmetics (guild_id, cosmetic_id) values (p_guild_id, p_cosmetic_id);

  return jsonb_build_object('remaining_credits', v_leader.premium_credits - v_price);
end;
$$;

grant execute on function purchase_guild_cosmetic(uuid, uuid) to authenticated;

create or replace function equip_guild_shield(
  p_guild_id            uuid,
  p_shape_id            uuid,
  p_primary_color_id    uuid,
  p_secondary_color_id  uuid,
  p_icon_id             uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team       teams%rowtype;
  v_membership guild_members%rowtype;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select * into v_membership from guild_members
    where team_id = v_team.id and guild_id = p_guild_id;
  if not found or v_membership.role not in ('leader', 'officer') then
    raise exception 'not_authorized';
  end if;

  perform 1 from cosmetics where id = p_shape_id and category = 'guild_shield_shape' and is_active;
  if not found then
    raise exception 'invalid_shape';
  end if;

  perform 1 from cosmetics where id = p_primary_color_id and category = 'guild_shield_primary_color' and is_active;
  if not found then
    raise exception 'invalid_primary_color';
  end if;

  perform 1 from cosmetics where id = p_secondary_color_id and category = 'guild_shield_secondary_color' and is_active;
  if not found then
    raise exception 'invalid_secondary_color';
  end if;

  perform 1 from cosmetics where id = p_icon_id and category = 'guild_shield_icon' and is_active;
  if not found then
    raise exception 'invalid_icon';
  end if;

  if (
    select count(*) from guild_cosmetics
    where guild_id = p_guild_id
      and cosmetic_id in (p_shape_id, p_primary_color_id, p_secondary_color_id, p_icon_id)
  ) <> 4 then
    raise exception 'not_owned';
  end if;

  update guilds set equipped_cosmetics = equipped_cosmetics || jsonb_build_object(
      'guild_shield_shape',           p_shape_id::text,
      'guild_shield_primary_color',   p_primary_color_id::text,
      'guild_shield_secondary_color', p_secondary_color_id::text,
      'guild_shield_icon',            p_icon_id::text
    )
    where id = p_guild_id;
end;
$$;

grant execute on function equip_guild_shield(uuid, uuid, uuid, uuid, uuid) to authenticated;
