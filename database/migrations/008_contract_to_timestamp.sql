-- Migration 008: Alterar coluna contract de text para timestamptz
-- Run this AFTER migration 007

alter table players
  drop column contract,
  add column contract_end timestamptz not null default (now() + interval '15 days');
