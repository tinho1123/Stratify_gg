-- Migration 012: Tabela de leilões de jogadores
-- Run this AFTER migration 011

create table if not exists auctions (
  id                      uuid primary key default gen_random_uuid(),
  player_id               uuid not null references players(id) on delete cascade,
  seller_team_id          uuid not null references teams(id) on delete cascade,
  start_price             integer not null default 1000 check (start_price > 0),
  current_bid             integer not null default 0,
  current_bidder_team_id  uuid references teams(id),
  ends_at                 timestamptz not null default (now() + interval '24 hours'),
  status                  text not null default 'active'
                            check (status in ('active', 'ended', 'cancelled')),
  created_at              timestamptz not null default now()
);

alter table auctions enable row level security;

-- Qualquer usuário autenticado pode visualizar leilões ativos
create policy "Auctions are viewable by authenticated users"
  on auctions for select
  to authenticated
  using (true);

-- Times autenticados podem listar seus próprios jogadores
create policy "Teams can create auctions for their players"
  on auctions for insert
  to authenticated
  with check (
    seller_team_id in (
      select id from teams where user_id = auth.uid()
    )
  );

-- Qualquer autenticado pode atualizar lance (bid) — validação de valor no app
create policy "Authenticated users can place bids"
  on auctions for update
  to authenticated
  using (status = 'active');

-- Index para busca rápida de leilões ativos
create index if not exists auctions_status_ends_at_idx
  on auctions (status, ends_at asc);

create index if not exists auctions_seller_team_id_idx
  on auctions (seller_team_id);
