-- Migration 056: Versão mínima obrigatória do app
-- Run this AFTER migration 055
--
-- Permite bloquear clients desatualizados que ficariam quebrados por mudanças de schema/RPC
-- (ex.: assinatura de função alterada, coluna removida) sem dar nenhum aviso ao usuário. Leitura
-- pública (inclusive anon) porque essa checagem precisa rodar antes de qualquer login.

create table if not exists app_min_version (
  platform    text primary key check (platform in ('ios', 'android')),
  min_version text not null,
  updated_at  timestamptz not null default now()
);

alter table app_min_version enable row level security;

create policy "Anyone can view minimum app version"
  on app_min_version for select
  to anon, authenticated
  using (true);

insert into app_min_version (platform, min_version) values
  ('android', '1.0.0'),
  ('ios',     '1.0.0')
on conflict (platform) do nothing;
