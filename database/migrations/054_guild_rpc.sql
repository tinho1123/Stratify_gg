-- Migration 054: Funções de guilda (criação, membership, convites e ranking)
-- Run this AFTER migration 053
--
-- Todas as funções são SECURITY DEFINER e resolvem o time do chamador via `auth.uid()` — nunca
-- aceitam o "meu time" como parâmetro do client, só o alvo de uma ação (ex. team_id a convidar,
-- guild_id a entrar). Mesmo padrão de `resolve_match`/`place_bid` (migration 017) e
-- `join_season` (migration 018).

-- ── create_guild(): cria guilda e vira líder automaticamente ────────────────────────────────
-- Custa `v_guild_cost` diamantes (premium_credits) — moeda que só se ganha com dinheiro real
-- (IAP) ou anúncio recompensado (grant_ad_reward, migration 034), nunca com o budget do jogo.
-- Mesmo padrão de validação/dedução de purchase_cosmetic (migration 032): busca o saldo via
-- auth.uid(), valida antes de gastar, deduz e cria na mesma transação.
create or replace function create_guild(p_name text, p_description text default '', p_is_public boolean default true)
returns guilds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guild_cost constant integer := 1000;
  v_team  teams%rowtype;
  v_clean text;
  v_guild guilds%rowtype;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  if exists (select 1 from guild_members where team_id = v_team.id) then
    raise exception 'already_in_guild';
  end if;

  if v_team.last_guild_created_at is not null and v_team.last_guild_created_at > now() - interval '10 minutes' then
    raise exception 'rate_limited';
  end if;

  if v_team.premium_credits < v_guild_cost then
    raise exception 'insufficient_credits';
  end if;

  if char_length(trim(p_name)) < 3 or char_length(trim(p_name)) > 30 then
    raise exception 'invalid_name';
  end if;
  if char_length(p_description) > 200 then
    raise exception 'invalid_description';
  end if;

  v_clean := filter_offensive_words(trim(p_name));

  begin
    insert into guilds (name, description, is_public, leader_team_id)
    values (v_clean, p_description, p_is_public, v_team.id)
    returning * into v_guild;
  exception when unique_violation then
    raise exception 'guild_name_taken';
  end;

  insert into guild_members (guild_id, team_id, role)
  values (v_guild.id, v_team.id, 'leader');

  update teams set
    last_guild_created_at = now(),
    premium_credits       = premium_credits - v_guild_cost
  where id = v_team.id;

  return v_guild;
end;
$$;

grant execute on function create_guild(text, text, boolean) to authenticated;

-- ── leave_guild(): sai da guilda; promove sucessor se for líder, ou dissolve se for o único ──
create or replace function leave_guild()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team       teams%rowtype;
  v_membership guild_members%rowtype;
  v_successor  uuid;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select * into v_membership from guild_members where team_id = v_team.id for update;
  if not found then
    raise exception 'not_in_guild';
  end if;

  if v_membership.role = 'leader' then
    select team_id into v_successor
      from guild_members
      where guild_id = v_membership.guild_id and team_id <> v_team.id
      order by (role = 'officer') desc, joined_at asc
      limit 1;

    if v_successor is null then
      delete from guilds where id = v_membership.guild_id;
    else
      update guild_members set role = 'leader' where guild_id = v_membership.guild_id and team_id = v_successor;
      delete from guild_members where guild_id = v_membership.guild_id and team_id = v_team.id;
    end if;
  else
    delete from guild_members where guild_id = v_membership.guild_id and team_id = v_team.id;
  end if;

  update guild_invites set status = 'cancelled', resolved_at = now()
    where team_id = v_team.id and status = 'pending';
end;
$$;

grant execute on function leave_guild() to authenticated;

-- ── kick_member(): líder/oficial expulsa um membro (não pode expulsar o líder) ───────────────
create or replace function kick_member(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team       teams%rowtype;
  v_membership guild_members%rowtype;
  v_target     guild_members%rowtype;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select * into v_membership from guild_members where team_id = v_team.id;
  if not found or v_membership.role not in ('leader', 'officer') then
    raise exception 'not_authorized';
  end if;

  select * into v_target from guild_members
    where team_id = p_team_id and guild_id = v_membership.guild_id;
  if not found then
    raise exception 'member_not_found';
  end if;

  if v_target.role = 'leader' then
    raise exception 'cannot_kick_leader';
  end if;

  delete from guild_members where guild_id = v_membership.guild_id and team_id = p_team_id;
end;
$$;

grant execute on function kick_member(uuid) to authenticated;

-- ── invite_team(): líder/oficial convida um time (guilda pública ou privada) ─────────────────
create or replace function invite_team(p_guild_id uuid, p_team_id uuid)
returns guild_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team       teams%rowtype;
  v_membership guild_members%rowtype;
  v_row        guild_invites%rowtype;
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

  if exists (select 1 from guild_members where team_id = p_team_id) then
    raise exception 'already_in_guild';
  end if;

  if (select count(*) from guild_members where guild_id = p_guild_id) >= 25 then
    raise exception 'guild_full';
  end if;

  begin
    insert into guild_invites (guild_id, team_id, kind)
    values (p_guild_id, p_team_id, 'invite')
    returning * into v_row;
  exception when unique_violation then
    raise exception 'invite_already_pending';
  end;

  return v_row;
end;
$$;

grant execute on function invite_team(uuid, uuid) to authenticated;

-- ── join_guild(): entra direto numa guilda pública ───────────────────────────────────────────
create or replace function join_guild(p_guild_id uuid)
returns guild_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team  teams%rowtype;
  v_guild guilds%rowtype;
  v_row   guild_members%rowtype;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select * into v_guild from guilds where id = p_guild_id for update;
  if not found then
    raise exception 'guild_not_found';
  end if;

  if not v_guild.is_public then
    raise exception 'guild_is_private';
  end if;

  if exists (select 1 from guild_members where team_id = v_team.id) then
    raise exception 'already_in_guild';
  end if;

  if (select count(*) from guild_members where guild_id = p_guild_id) >= 25 then
    raise exception 'guild_full';
  end if;

  insert into guild_members (guild_id, team_id, role)
  values (p_guild_id, v_team.id, 'member')
  returning * into v_row;

  update guild_invites set status = 'cancelled', resolved_at = now()
    where team_id = v_team.id and status = 'pending';

  return v_row;
end;
$$;

grant execute on function join_guild(uuid) to authenticated;

-- ── request_join(): pede pra entrar numa guilda privada ──────────────────────────────────────
create or replace function request_join(p_guild_id uuid)
returns guild_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team  teams%rowtype;
  v_guild guilds%rowtype;
  v_row   guild_invites%rowtype;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select * into v_guild from guilds where id = p_guild_id;
  if not found then
    raise exception 'guild_not_found';
  end if;

  if v_guild.is_public then
    raise exception 'guild_is_public';
  end if;

  if exists (select 1 from guild_members where team_id = v_team.id) then
    raise exception 'already_in_guild';
  end if;

  if (select count(*) from guild_members where guild_id = p_guild_id) >= 25 then
    raise exception 'guild_full';
  end if;

  begin
    insert into guild_invites (guild_id, team_id, kind)
    values (p_guild_id, v_team.id, 'request')
    returning * into v_row;
  exception when unique_violation then
    raise exception 'invite_already_pending';
  end;

  return v_row;
end;
$$;

grant execute on function request_join(uuid) to authenticated;

-- ── accept_invite(): dono do convite aceita 'invite'; líder/oficial aceita 'request' ─────────
create or replace function accept_invite(p_invite_id uuid)
returns guild_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team    teams%rowtype;
  v_invite  guild_invites%rowtype;
  v_row     guild_members%rowtype;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select * into v_invite from guild_invites where id = p_invite_id and status = 'pending' for update;
  if not found then
    raise exception 'invite_not_found';
  end if;

  if v_invite.kind = 'invite' then
    if v_invite.team_id <> v_team.id then
      raise exception 'not_authorized';
    end if;
  else
    if not exists (
      select 1 from guild_members
      where team_id = v_team.id and guild_id = v_invite.guild_id and role in ('leader', 'officer')
    ) then
      raise exception 'not_authorized';
    end if;
  end if;

  if exists (select 1 from guild_members where team_id = v_invite.team_id) then
    update guild_invites set status = 'cancelled', resolved_at = now() where id = p_invite_id;
    raise exception 'already_in_guild';
  end if;

  if (select count(*) from guild_members where guild_id = v_invite.guild_id) >= 25 then
    raise exception 'guild_full';
  end if;

  insert into guild_members (guild_id, team_id, role)
  values (v_invite.guild_id, v_invite.team_id, 'member')
  returning * into v_row;

  update guild_invites set status = 'accepted', resolved_at = now() where id = p_invite_id;

  update guild_invites set status = 'cancelled', resolved_at = now()
    where team_id = v_invite.team_id and status = 'pending' and id <> p_invite_id;

  return v_row;
end;
$$;

grant execute on function accept_invite(uuid) to authenticated;

-- ── decline_invite(): destinatário natural recusa ────────────────────────────────────────────
create or replace function decline_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team   teams%rowtype;
  v_invite guild_invites%rowtype;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select * into v_invite from guild_invites where id = p_invite_id and status = 'pending' for update;
  if not found then
    raise exception 'invite_not_found';
  end if;

  if v_invite.kind = 'invite' then
    if v_invite.team_id <> v_team.id then
      raise exception 'not_authorized';
    end if;
  else
    if not exists (
      select 1 from guild_members
      where team_id = v_team.id and guild_id = v_invite.guild_id and role in ('leader', 'officer')
    ) then
      raise exception 'not_authorized';
    end if;
  end if;

  update guild_invites set status = 'declined', resolved_at = now() where id = p_invite_id;
end;
$$;

grant execute on function decline_invite(uuid) to authenticated;

-- ── cancel_invite(): quem originou desiste (líder/oficial cancela convite; time cancela pedido) ─
create or replace function cancel_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team   teams%rowtype;
  v_invite guild_invites%rowtype;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select * into v_invite from guild_invites where id = p_invite_id and status = 'pending' for update;
  if not found then
    raise exception 'invite_not_found';
  end if;

  if v_invite.kind = 'invite' then
    if not exists (
      select 1 from guild_members
      where team_id = v_team.id and guild_id = v_invite.guild_id and role in ('leader', 'officer')
    ) then
      raise exception 'not_authorized';
    end if;
  else
    if v_invite.team_id <> v_team.id then
      raise exception 'not_authorized';
    end if;
  end if;

  update guild_invites set status = 'cancelled', resolved_at = now() where id = p_invite_id;
end;
$$;

grant execute on function cancel_invite(uuid) to authenticated;

-- ── transfer_leadership(): líder atual passa a coroa; antigo líder vira oficial ──────────────
create or replace function transfer_leadership(p_new_leader_team_id uuid)
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

  select * into v_membership from guild_members where team_id = v_team.id;
  if not found or v_membership.role <> 'leader' then
    raise exception 'not_authorized';
  end if;

  if not exists (
    select 1 from guild_members where team_id = p_new_leader_team_id and guild_id = v_membership.guild_id
  ) then
    raise exception 'member_not_found';
  end if;

  update guild_members set role = 'officer' where guild_id = v_membership.guild_id and team_id = v_team.id;
  update guild_members set role = 'leader' where guild_id = v_membership.guild_id and team_id = p_new_leader_team_id;
end;
$$;

grant execute on function transfer_leadership(uuid) to authenticated;

-- ── set_officer(): só o líder promove/rebaixa oficiais ───────────────────────────────────────
create or replace function set_officer(p_team_id uuid, p_is_officer boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team       teams%rowtype;
  v_membership guild_members%rowtype;
  v_target     guild_members%rowtype;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select * into v_membership from guild_members where team_id = v_team.id;
  if not found or v_membership.role <> 'leader' then
    raise exception 'not_authorized';
  end if;

  select * into v_target from guild_members
    where team_id = p_team_id and guild_id = v_membership.guild_id;
  if not found or v_target.role = 'leader' then
    raise exception 'member_not_found';
  end if;

  update guild_members set role = case when p_is_officer then 'officer' else 'member' end
    where guild_id = v_membership.guild_id and team_id = p_team_id;
end;
$$;

grant execute on function set_officer(uuid, boolean) to authenticated;

-- ── get_guild_leaderboard(): ranking global por soma de PDL dos membros atuais ───────────────
-- `join` (não `left join`) faz guildas com 0 membros somem naturalmente do ranking. Não expõe
-- budget/fans individuais dos times membros, só o agregado de PDL.
create or replace function get_guild_leaderboard(p_limit integer default 100)
returns table (
  rank         integer,
  guild_id     uuid,
  guild_name   text,
  is_public    boolean,
  member_count integer,
  total_pdl    bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (row_number() over (order by sum(t.pdl) desc, g.id))::integer as rank,
    g.id,
    g.name,
    g.is_public,
    count(gm.team_id)::integer,
    sum(t.pdl)::bigint
  from guilds g
  join guild_members gm on gm.guild_id = g.id
  join teams t on t.id = gm.team_id
  group by g.id
  order by sum(t.pdl) desc, g.id
  limit greatest(0, p_limit);
$$;

grant execute on function get_guild_leaderboard(integer) to authenticated;

-- ── get_my_guild(): dados da guilda do próprio time, ou null se não estiver em nenhuma ───────
create or replace function get_my_guild()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team       teams%rowtype;
  v_membership guild_members%rowtype;
  v_guild      guilds%rowtype;
  v_members    jsonb;
  v_invites    jsonb;
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
    'guild_id',     v_guild.id,
    'name',         v_guild.name,
    'description',  v_guild.description,
    'is_public',    v_guild.is_public,
    'my_role',      v_membership.role,
    'member_count', jsonb_array_length(v_members),
    'total_pdl',    (select coalesce(sum(t.pdl), 0) from guild_members gm join teams t on t.id = gm.team_id where gm.guild_id = v_guild.id),
    'members',      v_members,
    'pending',      v_invites
  );
end;
$$;

grant execute on function get_my_guild() to authenticated;

-- ── get_guild_public_profile(): perfil público de outra guilda ──────────────────────────────
create or replace function get_guild_public_profile(p_guild_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guild      guilds%rowtype;
  v_leader_name text;
  v_members    jsonb;
begin
  select * into v_guild from guilds where id = p_guild_id;
  if not found then
    raise exception 'guild_not_found';
  end if;

  select t.name into v_leader_name from teams t where t.id = v_guild.leader_team_id;

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

  return jsonb_build_object(
    'guild_id',     v_guild.id,
    'name',         v_guild.name,
    'description',  v_guild.description,
    'is_public',    v_guild.is_public,
    'leader_name',  v_leader_name,
    'member_count', jsonb_array_length(v_members),
    'total_pdl',    (select coalesce(sum(t.pdl), 0) from guild_members gm join teams t on t.id = gm.team_id where gm.guild_id = v_guild.id),
    'members',      v_members
  );
end;
$$;

grant execute on function get_guild_public_profile(uuid) to authenticated;

-- ── get_my_guild_invites(): convites/pedidos pendentes relevantes ao time chamador ───────────
create or replace function get_my_guild_invites()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team teams%rowtype;
  v_result jsonb;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', gi.id, 'kind', gi.kind, 'guild_id', gi.guild_id,
        'guild_name', g.name, 'created_at', gi.created_at
      )
      order by gi.created_at desc
    ), '[]'::jsonb)
    into v_result
    from guild_invites gi
    join guilds g on g.id = gi.guild_id
    where gi.status = 'pending'
      and (
        (gi.kind = 'invite' and gi.team_id = v_team.id)
        or (gi.kind = 'request' and gi.guild_id in (
          select gm.guild_id from guild_members gm
          where gm.team_id = v_team.id and gm.role in ('leader', 'officer')
        ))
      );

  return v_result;
end;
$$;

grant execute on function get_my_guild_invites() to authenticated;
