-- Migration 052: Denúncia e bloqueio de usuários no chat
-- Run this AFTER migration 051
--
-- Exigido pela Apple (App Store Review Guideline 1.2, User-Generated Content) e pelas
-- políticas de conteúdo do Google Play pra apps com chat entre usuários: precisa existir um
-- jeito de denunciar conteúdo/usuário abusivo e de bloquear outro usuário. Hoje só existia o
-- filtro de palavras banidas (migration 042) — que barra palavrão, não comportamento abusivo
-- em geral (assédio, spam, etc.).
--
-- Mesmo modelo de segurança do resto do chat: o client nunca grava em `reports`/`blocked_users`
-- direto, só via função SECURITY DEFINER, que deriva o time do chamador via auth.uid() (nunca
-- confia em nenhum team_id vindo do client pra identidade de quem denuncia/bloqueia).

create table if not exists reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_team_id  uuid not null references teams(id) on delete cascade,
  reported_team_id  uuid not null references teams(id) on delete cascade,
  source            text not null check (source in ('chat_message', 'dm_message')),
  message_id        uuid not null,
  message_snapshot  text not null, -- cópia do texto no momento da denúncia; a mensagem original pode mudar/sumir depois
  reason            text not null check (reason in ('harassment', 'hate_speech', 'spam', 'inappropriate_content', 'other')),
  details           text,
  created_at        timestamptz not null default now()
);

alter table reports enable row level security;
-- Sem nenhuma policy -> ninguém entre authenticated/anon lê essa tabela via API (moderação é
-- feita direto no painel do Supabase, mesmo padrão de `banned_words`).

create index if not exists reports_reported_team_idx on reports (reported_team_id, created_at desc);

create table if not exists blocked_users (
  blocker_team_id uuid not null references teams(id) on delete cascade,
  blocked_team_id uuid not null references teams(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (blocker_team_id, blocked_team_id),
  constraint blocked_users_not_self check (blocker_team_id <> blocked_team_id)
);

alter table blocked_users enable row level security;

create policy "Users can view their own blocklist"
  on blocked_users for select
  to authenticated
  using (blocker_team_id in (select id from teams where user_id = auth.uid()));

-- Sem policy de insert/delete -> só block_user()/unblock_user() escrevem.

-- ── report_message(): denuncia uma mensagem (chat global ou DM) ────────────────────────────
create or replace function report_message(
  p_source   text,
  p_message_id uuid,
  p_reason   text,
  p_details  text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id       uuid;
  v_reported_team uuid;
  v_message_text  text;
begin
  select id into v_team_id from teams where user_id = auth.uid();
  if v_team_id is null then
    raise exception 'team_not_found';
  end if;

  if p_source not in ('chat_message', 'dm_message') then
    raise exception 'invalid_source';
  end if;

  if p_reason not in ('harassment', 'hate_speech', 'spam', 'inappropriate_content', 'other') then
    raise exception 'invalid_reason';
  end if;

  if p_source = 'chat_message' then
    select team_id, message into v_reported_team, v_message_text
      from chat_messages where id = p_message_id;
  else
    select sender_team_id, message into v_reported_team, v_message_text
      from dm_messages where id = p_message_id;

    if v_reported_team is not null and not exists (
      select 1 from dm_messages m
        join dm_conversations c on c.id = m.conversation_id
       where m.id = p_message_id
         and (c.team_a_id = v_team_id or c.team_b_id = v_team_id)
    ) then
      raise exception 'not_a_participant';
    end if;
  end if;

  if v_reported_team is null then
    raise exception 'message_not_found';
  end if;

  if v_reported_team = v_team_id then
    raise exception 'cannot_report_self';
  end if;

  insert into reports (reporter_team_id, reported_team_id, source, message_id, message_snapshot, reason, details)
  values (v_team_id, v_reported_team, p_source, p_message_id, v_message_text, p_reason, p_details);
end;
$$;

grant execute on function report_message(text, uuid, text, text) to authenticated;

-- ── block_user() / unblock_user() ───────────────────────────────────────────────────────────
create or replace function block_user(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  select id into v_team_id from teams where user_id = auth.uid();
  if v_team_id is null then
    raise exception 'team_not_found';
  end if;

  if p_team_id = v_team_id then
    raise exception 'cannot_block_self';
  end if;

  if not exists (select 1 from teams where id = p_team_id) then
    raise exception 'team_not_found';
  end if;

  insert into blocked_users (blocker_team_id, blocked_team_id)
  values (v_team_id, p_team_id)
  on conflict (blocker_team_id, blocked_team_id) do nothing;
end;
$$;

grant execute on function block_user(uuid) to authenticated;

create or replace function unblock_user(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  select id into v_team_id from teams where user_id = auth.uid();
  if v_team_id is null then
    raise exception 'team_not_found';
  end if;

  delete from blocked_users where blocker_team_id = v_team_id and blocked_team_id = p_team_id;
end;
$$;

grant execute on function unblock_user(uuid) to authenticated;

-- ── get_my_conversations(): não mostra mais conversas com times que eu bloqueei ─────────────
create or replace function get_my_conversations()
returns table (
  conversation_id  uuid,
  other_team_id    uuid,
  other_team_name  text,
  other_pdl        integer,
  other_name_color text,
  last_message     text,
  last_message_at  timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id,
    ot.id,
    ot.name,
    ot.pdl,
    oc.preview->>'color',
    lm.message,
    c.last_message_at
  from dm_conversations c
  join teams mt on mt.user_id = auth.uid()
  join teams ot on ot.id = (case when c.team_a_id = mt.id then c.team_b_id else c.team_a_id end)
  left join cosmetics oc on oc.id = nullif(ot.equipped_cosmetics->>'name_color', '')::uuid
  left join lateral (
    select message from dm_messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where (c.team_a_id = mt.id or c.team_b_id = mt.id)
    and not exists (
      select 1 from blocked_users b
       where b.blocker_team_id = mt.id and b.blocked_team_id = ot.id
    )
  order by c.last_message_at desc nulls last, c.created_at desc;
$$;

grant execute on function get_my_conversations() to authenticated;

-- ── start_dm_conversation(): não deixa iniciar conversa com quem bloqueou/foi bloqueado ─────
create or replace function start_dm_conversation(p_other_team_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_a       uuid;
  v_b       uuid;
  v_conv_id uuid;
begin
  select id into v_team_id from teams where user_id = auth.uid();
  if v_team_id is null then
    raise exception 'team_not_found';
  end if;

  if p_other_team_id = v_team_id then
    raise exception 'cannot_message_self';
  end if;

  if not exists (select 1 from teams where id = p_other_team_id) then
    raise exception 'other_team_not_found';
  end if;

  if exists (
    select 1 from blocked_users
     where (blocker_team_id = v_team_id and blocked_team_id = p_other_team_id)
        or (blocker_team_id = p_other_team_id and blocked_team_id = v_team_id)
  ) then
    raise exception 'blocked';
  end if;

  v_a := least(v_team_id, p_other_team_id);
  v_b := greatest(v_team_id, p_other_team_id);

  insert into dm_conversations (team_a_id, team_b_id)
  values (v_a, v_b)
  on conflict (team_a_id, team_b_id) do nothing;

  select id into v_conv_id from dm_conversations where team_a_id = v_a and team_b_id = v_b;

  return v_conv_id;
end;
$$;

grant execute on function start_dm_conversation(uuid) to authenticated;

-- ── send_dm_message(): passa a barrar envio se qualquer um dos dois bloqueou o outro ───────
create or replace function send_dm_message(p_conversation_id uuid, p_message text)
returns dm_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team          teams%rowtype;
  v_conv          dm_conversations%rowtype;
  v_clean         text;
  v_row           dm_messages%rowtype;
  v_other_team_id uuid;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  select * into v_conv from dm_conversations where id = p_conversation_id;
  if not found then
    raise exception 'conversation_not_found';
  end if;

  if v_team.id <> v_conv.team_a_id and v_team.id <> v_conv.team_b_id then
    raise exception 'not_a_participant';
  end if;

  v_other_team_id := case when v_conv.team_a_id = v_team.id then v_conv.team_b_id else v_conv.team_a_id end;

  if exists (
    select 1 from blocked_users
     where (blocker_team_id = v_team.id and blocked_team_id = v_other_team_id)
        or (blocker_team_id = v_other_team_id and blocked_team_id = v_team.id)
  ) then
    raise exception 'blocked';
  end if;

  if v_team.last_dm_message_at is not null and v_team.last_dm_message_at > now() - interval '2 seconds' then
    raise exception 'rate_limited';
  end if;

  if length(trim(p_message)) = 0 then
    raise exception 'empty_message';
  end if;

  if length(p_message) > 300 then
    raise exception 'message_too_long';
  end if;

  v_clean := filter_offensive_words(p_message);

  insert into dm_messages (conversation_id, sender_team_id, message)
  values (p_conversation_id, v_team.id, v_clean)
  returning * into v_row;

  update dm_conversations set last_message_at = now() where id = p_conversation_id;
  update teams set last_dm_message_at = now() where id = v_team.id;

  return v_row;
end;
$$;

grant execute on function send_dm_message(uuid, text) to authenticated;
