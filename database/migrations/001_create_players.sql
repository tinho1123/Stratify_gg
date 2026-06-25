-- Migration 001: Create players table
-- Run this in the Supabase SQL Editor

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  status text not null default 'online' check (status in ('online', 'injured', 'banned')),
  rating integer not null default 0 check (rating between 0 and 100),
  salary integer not null default 0,
  contract_end timestamptz not null default (now() + interval '15 days'),
  age integer not null,
  energy integer not null default 100 check (energy between 0 and 100),
  morale integer not null default 100 check (morale between 0 and 100),
  form integer not null default 100 check (form between 0 and 100),
  kills integer not null default 0,
  deaths integer not null default 0,
  assists integer not null default 0,
  adr numeric(5,2) not null default 0,
  team_id    uuid references teams(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table players enable row level security;

-- Policy: allow authenticated users to read all players
create policy "Players are viewable by authenticated users"
  on players for select
  to authenticated
  using (true);

-- Policy: allow authenticated users to insert/update players
create policy "Players are editable by authenticated users"
  on players for all
  to authenticated
  using (true);

-- Seed data: run `npm run seed` to populate with randomly generated players
