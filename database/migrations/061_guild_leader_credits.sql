-- Migration 061: get_my_guild() passa a expor equipped_cosmetics e o saldo do time líder
-- Run this AFTER migration 060
--
-- Duas coisas que a tela de escudo de guilda precisa e get_my_guild() (migration 054) ainda
-- não devolvia:
--   1. `equipped_cosmetics` da guilda — pra saber qual escudo está equipado atualmente.
--   2. `leader_premium_credits` — pra um oficial (não-líder) ver quanto saldo o líder tem
--      disponível antes de tentar comprar uma peça (a compra sempre debita do líder, migration
--      060). É só mais uma leitura agregada, não expõe budget/fans do time líder.

create or replace function get_my_guild()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team           teams%rowtype;
  v_membership     guild_members%rowtype;
  v_guild          guilds%rowtype;
  v_members        jsonb;
  v_invites        jsonb;
  v_leader_credits integer;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select * into v_membership from guild_members where team_id = v_team.id;
  if not found then
    return null;
  end if;

  select * into v_guild from guilds where id = v_membership.guild_id;

  select premium_credits into v_leader_credits from teams where id = v_guild.leader_team_id;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'team_id',    t.id,
        'team_name',  t.name,
        'pdl',        t.pdl,
        'role',       gm.role,
        'name_color', c.preview->>'color'
      )
      order by t.pdl desc
    ), '[]'::jsonb)
    into v_members
    from guild_members gm
    join teams t on t.id = gm.team_id
    left join cosmetics c on c.id = nullif(t.equipped_cosmetics->>'name_color', '')::uuid
    where gm.guild_id = v_guild.id;

  v_invites := '[]'::jsonb;
  if v_membership.role in ('leader', 'officer') then
    select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', gi.id, 'kind', gi.kind, 'team_id', gi.team_id,
          'team_name', t.name, 'created_at', gi.created_at
        )
        order by gi.created_at
      ), '[]'::jsonb)
      into v_invites
      from guild_invites gi
      join teams t on t.id = gi.team_id
      where gi.guild_id = v_guild.id and gi.status = 'pending';
  end if;

  return jsonb_build_object(
    'guild_id',              v_guild.id,
    'name',                  v_guild.name,
    'description',           v_guild.description,
    'is_public',             v_guild.is_public,
    'my_role',                v_membership.role,
    'member_count',          jsonb_array_length(v_members),
    'total_pdl',             (select coalesce(sum(t.pdl), 0) from guild_members gm join teams t on t.id = gm.team_id where gm.guild_id = v_guild.id),
    'members',               v_members,
    'pending',               v_invites,
    'equipped_cosmetics',    v_guild.equipped_cosmetics,
    'leader_premium_credits', coalesce(v_leader_credits, 0)
  );
end;
$$;

grant execute on function get_my_guild() to authenticated;
