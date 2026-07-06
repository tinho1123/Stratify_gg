-- Migration 044: Ranking global (leaderboard) de times por PDL
-- Run this AFTER migration 043
--
-- `teams` só é legível pelo próprio dono via RLS (migration 006) — não dá pra listar outros times
-- direto com `supabase.from("teams").select(...)`. Pra exibir um ranking global sem abrir a tabela
-- inteira (que teria budget, fans etc.), a leitura passa por duas funções SECURITY DEFINER que só
-- devolvem os campos necessários pro ranking (nome, pdl, wins, losses, cor do nome equipada),
-- igual ao padrão já usado no chat (migration 042/043) pra expor dado de outros times com segurança.

create or replace function get_leaderboard(p_limit integer default 100)
returns table (
  rank       integer,
  team_id    uuid,
  team_name  text,
  pdl        integer,
  wins       integer,
  losses     integer,
  name_color text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (row_number() over (order by t.pdl desc, t.wins desc, t.id))::integer as rank,
    t.id,
    t.name,
    t.pdl,
    t.wins,
    t.losses,
    c.preview->>'color' as name_color
  from teams t
  left join cosmetics c on c.id = nullif(t.equipped_cosmetics->>'name_color', '')::uuid
  order by t.pdl desc, t.wins desc, t.id
  limit greatest(0, p_limit);
$$;

grant execute on function get_leaderboard(integer) to authenticated;

-- get_my_rank(): posição do próprio time no ranking, mesmo fora do top exibido por get_leaderboard.
create or replace function get_my_rank()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_rank    integer;
  v_total   integer;
begin
  select id into v_team_id from teams where user_id = auth.uid();
  if v_team_id is null then
    raise exception 'team_not_found';
  end if;

  select count(*) into v_total from teams;

  select ranked.rank into v_rank from (
    select t.id, (row_number() over (order by t.pdl desc, t.wins desc, t.id))::integer as rank
    from teams t
  ) ranked
  where ranked.id = v_team_id;

  return jsonb_build_object('rank', v_rank, 'total', v_total);
end;
$$;

grant execute on function get_my_rank() to authenticated;
