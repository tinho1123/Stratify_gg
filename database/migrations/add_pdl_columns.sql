-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Add PDL column to teams table (defaults to 0 = Bronze III)
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS pdl INTEGER NOT NULL DEFAULT 0;

-- 2. Add pdl_delta column to matches table (PDL gained/lost per match)
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS pdl_delta INTEGER NOT NULL DEFAULT 0;

-- 3. Add is_bot flag to matches table (true when no real opponent was found in the same tier)
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT false;
