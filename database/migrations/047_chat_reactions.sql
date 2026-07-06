-- Migration 047: Reações (emoji) nas mensagens do chat global
-- Run this AFTER migration 046
--
-- Mesmo padrão de segurança do resto do chat: o client nunca grava em `chat_message_reactions`
-- direto (sem policy de insert/delete pra authenticated) — só `toggle_chat_reaction()`
-- (SECURITY DEFINER) escreve, o que garante que só os emojis da whitelist (check constraint)
-- entram na tabela e que cada time só consegue reagir como o próprio time (nunca em nome de outro).
--
-- Emoji fixo (não é texto livre) pra evitar spam/abuso na reação — mesma lista que aparece no
-- seletor do client.

create table if not exists chat_message_reactions (
  message_id uuid not null references chat_messages(id) on delete cascade,
  team_id    uuid not null references teams(id) on delete cascade,
  emoji      text not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🔥')),
  created_at timestamptz not null default now(),
  primary key (message_id, team_id, emoji)
);

alter table chat_message_reactions enable row level security;

create policy "Any authenticated user can view chat reactions"
  on chat_message_reactions for select
  to authenticated
  using (true);

-- Sem policy de insert/delete -> só toggle_chat_reaction() escreve.

create index if not exists chat_message_reactions_message_idx
  on chat_message_reactions (message_id);

-- Habilita Realtime nessa tabela (INSERT/DELETE passam a ser transmitidos via websocket).
alter publication supabase_realtime add table chat_message_reactions;

-- ── toggle_chat_reaction(): adiciona a reação do time, ou remove se ele já tinha reagido ───────
create or replace function toggle_chat_reaction(p_message_id uuid, p_emoji text)
returns text -- 'added' | 'removed'
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_deleted integer;
begin
  select id into v_team_id from teams where user_id = auth.uid();
  if v_team_id is null then
    raise exception 'team_not_found';
  end if;

  if not exists (select 1 from chat_messages where id = p_message_id) then
    raise exception 'message_not_found';
  end if;

  delete from chat_message_reactions
    where message_id = p_message_id and team_id = v_team_id and emoji = p_emoji;
  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    return 'removed';
  end if;

  insert into chat_message_reactions (message_id, team_id, emoji)
  values (p_message_id, v_team_id, p_emoji);

  return 'added';
end;
$$;

grant execute on function toggle_chat_reaction(uuid, text) to authenticated;
