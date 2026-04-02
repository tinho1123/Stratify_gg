-- Migration 001: Create players table
-- Run this in the Supabase SQL Editor

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  status text not null default 'online' check (status in ('online', 'offline', 'injured', 'banned')),
  rating integer not null default 0 check (rating between 0 and 100),
  salary integer not null default 0,
  contract text not null,
  age integer not null,
  energy integer not null default 100 check (energy between 0 and 100),
  morale integer not null default 100 check (morale between 0 and 100),
  form integer not null default 100 check (form between 0 and 100),
  kills integer not null default 0,
  deaths integer not null default 0,
  assists integer not null default 0,
  adr numeric(5,2) not null default 0,
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

-- Seed data
insert into players (name, role, status, rating, salary, contract, age, energy, morale, form, kills, deaths, assists, adr)
values
  ('Alice',   'IGL',     'online',  92, 15000, '2 anos',    24, 85, 90, 88, 1250, 980,  450, 82.50),
  ('Bob',     'AWPer',   'online',  88, 18000, '1 ano',     22, 75, 85, 92, 1450, 1020, 320, 88.20),
  ('Charlie', 'Support', 'online',  85, 12000, '3 anos',    26, 90, 88, 85, 980,  950,  680, 75.80),
  ('Diana',   'Entry',   'injured', 90, 16000, '6 meses',   21, 30, 60, 78, 1380, 1100, 420, 85.40),
  ('Eve',     'Flex',    'online',  87, 14000, '1.5 anos',  23, 88, 92, 90, 1280, 1050, 510, 80.30);
