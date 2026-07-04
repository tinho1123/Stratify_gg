-- Migration 005: Tabela de notificações por usuário
-- Run this AFTER migration 004

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null check (type in ('alert', 'info', 'success')),
  tag        text not null,
  message    text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS
alter table notifications enable row level security;

create policy "Users can view their own notifications"
  on notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can update their own notifications"
  on notifications for update
  to authenticated
  using (user_id = auth.uid());

-- Index para queries rápidas por usuário + não lidas
create index if not exists idx_notifications_user_unread
  on notifications (user_id, read, created_at desc);
