-- Migration 010: Adicionar team_id na tabela players
-- Run this AFTER migration 009

alter table players
  add column team_id uuid references teams(id) on delete cascade;
