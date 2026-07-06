-- Migration 036: Notificações push
-- Run this AFTER migration 035
--
-- O app já cria linhas em `notifications` pra vários eventos (partida pronta, contrato
-- vencendo, lesão, etc. — ver `check_expired_contracts`, `check_expiring_contracts`,
-- `resolve_match`). Esta migration só adiciona onde salvar o token de push de cada usuário; o
-- envio de fato acontece num Database Webhook (configurado no painel do Supabase) que dispara a
-- Edge Function `send-push-notification` a cada INSERT nessa tabela.

create table if not exists push_tokens (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  token      text not null,
  updated_at timestamptz not null default now()
);

alter table push_tokens enable row level security;

create policy "Users can view their own push token"
  on push_tokens for select
  to authenticated
  using (user_id = auth.uid());

-- Sem policy de insert/update pra authenticated -> só via save_push_token(). Não é um dado de
-- economia, mas centralizar em RPC evita duplicar/sobrescrever token de outro usuário e mantém
-- `updated_at` sempre correto.

create or replace function save_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into push_tokens (user_id, token, updated_at)
  values (auth.uid(), p_token, now())
  on conflict (user_id) do update set token = excluded.token, updated_at = now();
end;
$$;

grant execute on function save_push_token(text) to authenticated;
