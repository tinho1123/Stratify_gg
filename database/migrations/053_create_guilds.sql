-- Migration 053: Guildas (agrupamento de times), membership e convites
-- Run this AFTER migration 052
--
-- Guildas agrupam times ("clãs"). Um time só pode estar em UMA guilda ativa por vez
-- (garantido por `guild_members.team_id unique`, não só por lógica de aplicação). O ranking de
-- guildas (soma de PDL dos membros atuais) é lido via função SECURITY DEFINER na migration 054,
-- mesmo padrão de `get_leaderboard` (migration 044) e `season_standings` (migration 018): as
-- tabelas abaixo não têm NENHUMA policy de insert/update/delete para `authenticated` — toda
-- escrita passa pelas funções SECURITY DEFINER da migration 054, que sempre derivam o time do
-- chamador via `auth.uid()`, nunca de parâmetro do client.

create table if not exists guilds (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text not null default '',
  is_public      boolean not null default true,
  leader_team_id uuid not null references teams(id) on delete restrict,
  created_at     timestamptz not null default now(),
  constraint guilds_name_length check (char_length(name) between 3 and 30),
  constraint guilds_description_length check (char_length(description) <= 200)
);

-- Nome único, case-insensitive (sem depender da extensão `citext`, que não está habilitada).
create unique index if not exists guilds_name_unique_idx on guilds (lower(name));

alter table guilds enable row level security;

-- Nenhuma coluna sensível aqui (sem budget/fans agregados) — leitura liberada pra qualquer
-- autenticado, mesmo racional de `seasons` (migration 018).
create policy "Guilds are viewable by authenticated users"
  on guilds for select
  to authenticated
  using (true);

create table if not exists guild_members (
  guild_id  uuid not null references guilds(id) on delete cascade,
  team_id   uuid not null unique references teams(id) on delete cascade,
  role      text not null default 'member' check (role in ('leader', 'officer', 'member')),
  joined_at timestamptz not null default now(),
  primary key (guild_id, team_id)
);

alter table guild_members enable row level security;

create policy "Guild members are viewable by authenticated users"
  on guild_members for select
  to authenticated
  using (true);

create index if not exists guild_members_guild_idx on guild_members (guild_id);

create table if not exists guild_invites (
  id          uuid primary key default gen_random_uuid(),
  guild_id    uuid not null references guilds(id) on delete cascade,
  team_id     uuid not null references teams(id) on delete cascade,
  -- 'invite'  = líder/oficial convidou o time
  -- 'request' = time pediu pra entrar numa guilda privada
  kind        text not null check (kind in ('invite', 'request')),
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- No máximo 1 pendência ativa por par (guild_id, team_id) — não impede novo convite depois
-- que o anterior foi aceito/recusado/cancelado (histórico preservado).
create unique index if not exists guild_invites_pending_unique_idx
  on guild_invites (guild_id, team_id)
  where status = 'pending';

create index if not exists guild_invites_team_pending_idx
  on guild_invites (team_id) where status = 'pending';
create index if not exists guild_invites_guild_pending_idx
  on guild_invites (guild_id) where status = 'pending';

alter table guild_invites enable row level security;

-- Um time só vê convites/pedidos que envolvem ele mesmo, ou que foram feitos à guilda que
-- ele lidera/modera (pra listar solicitações pendentes recebidas).
create policy "Teams can view invites involving them"
  on guild_invites for select
  to authenticated
  using (
    team_id in (select id from teams where user_id = auth.uid())
    or guild_id in (
      select gm.guild_id from guild_members gm
      join teams t on t.id = gm.team_id
      where t.user_id = auth.uid() and gm.role in ('leader', 'officer')
    )
  );

-- Rate limit de criação de guilda (evita spam de criar/dissolver em loop), mesmo padrão de
-- `last_chat_message_at`/`last_dm_message_at` em `teams`.
alter table teams add column if not exists last_guild_created_at timestamptz;
