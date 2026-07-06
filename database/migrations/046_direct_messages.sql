-- Migration 046: Chat privado (DM) entre dois times
-- Run this AFTER migration 045
--
-- Mesmo modelo de segurança do chat global (migrations 042/043): o client nunca grava em
-- `dm_messages`/`dm_conversations` direto (sem policy de insert pra authenticated) — só
-- `start_dm_conversation`/`send_dm_message` (SECURITY DEFINER) escrevem, o que garante que o
-- filtro de palavras ofensivas e o rate limit valem de verdade, e que só os dois times
-- participantes conseguem gravar/ler aquela conversa.
--
-- `team_a_id`/`team_b_id` ficam sempre em ordem canônica (a < b) via `least`/`greatest` em
-- `start_dm_conversation`, isso garante no máximo uma conversa por par de times (unique
-- constraint), independente de quem inicia.

create table if not exists dm_conversations (
  id              uuid primary key default gen_random_uuid(),
  team_a_id       uuid not null references teams(id) on delete cascade,
  team_b_id       uuid not null references teams(id) on delete cascade,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  constraint dm_conversations_distinct_teams check (team_a_id <> team_b_id),
  constraint dm_conversations_canonical_order check (team_a_id < team_b_id),
  unique (team_a_id, team_b_id)
);

alter table dm_conversations enable row level security;

create policy "Teams can view their own DM conversations"
  on dm_conversations for select
  to authenticated
  using (
    team_a_id in (select id from teams where user_id = auth.uid())
    or team_b_id in (select id from teams where user_id = auth.uid())
  );

-- Sem policy de insert -> só start_dm_conversation() cria.

create table if not exists dm_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references dm_conversations(id) on delete cascade,
  sender_team_id  uuid not null references teams(id) on delete cascade,
  message         text not null,
  created_at      timestamptz not null default now()
);

alter table dm_messages enable row level security;

create policy "Teams can view messages from their own DM conversations"
  on dm_messages for select
  to authenticated
  using (
    conversation_id in (
      select id from dm_conversations
      where team_a_id in (select id from teams where user_id = auth.uid())
         or team_b_id in (select id from teams where user_id = auth.uid())
    )
  );

-- Sem policy de insert -> só send_dm_message() grava (é isso que faz o filtro/rate-limit valer).

create index if not exists dm_messages_conversation_created_idx
  on dm_messages (conversation_id, created_at desc);

alter table teams add column if not exists last_dm_message_at timestamptz;

-- Habilita Realtime nessa tabela (INSERTs passam a ser transmitidos via websocket).
alter publication supabase_realtime add table dm_messages;

-- ── start_dm_conversation(): pega a conversa existente com o time ou cria uma nova ───────────
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

-- ── send_dm_message(): única forma de gravar em dm_messages ──────────────────────────────────
create or replace function send_dm_message(p_conversation_id uuid, p_message text)
returns dm_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team  teams%rowtype;
  v_conv  dm_conversations%rowtype;
  v_clean text;
  v_row   dm_messages%rowtype;
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

-- ── get_my_conversations(): inbox — lista de conversas com preview e dados públicos do outro time
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
  where c.team_a_id = mt.id or c.team_b_id = mt.id
  order by c.last_message_at desc nulls last, c.created_at desc;
$$;

grant execute on function get_my_conversations() to authenticated;
