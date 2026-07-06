-- Migration 042: Chat por elo, com filtro de palavras ofensivas server-side
-- Run this AFTER migration 041
--
-- O filtro roda inteiramente dentro de `send_chat_message` (SECURITY DEFINER) — o client nunca
-- grava em `chat_messages` direto (sem policy de insert pra authenticated), senão o filtro seria
-- só decorativo: qualquer um poderia chamar a REST API do Supabase direto e ignorar o filtro do
-- app, exatamente o mesmo tipo de brecha que a regra de ouro do CLAUDE.md previne pra economia.
--
-- `banned_words` também não tem nenhuma policy de select pra authenticated/anon — a lista fica
-- só acessível de dentro da função (que roda como o dono da tabela e por isso ignora RLS),
-- assim ninguém consegue ler a lista completa via API pra descobrir o que não está coberto.
--
-- Limitação conhecida: é um filtro por palavra/raiz com word-boundary (case-insensitive), não
-- um sistema de moderação completo — não pega toda variação de leetspeak/espaçamento. Dá pra
-- ampliar a lista a qualquer momento só inserindo mais linhas em `banned_words`, sem redeploy.

create table if not exists banned_words (
  word text primary key
);

alter table banned_words enable row level security;
-- Sem nenhuma policy -> ninguém entre authenticated/anon consegue ler essa tabela via API.

insert into banned_words (word) values
  ('porra'), ('caralho'), ('merda'), ('puta'), ('putas'), ('viado'), ('bicha'),
  ('corno'), ('cornos'), ('vagabunda'), ('vagabundo'), ('vadia'), ('piranha'),
  ('desgraca'), ('desgraça'), ('cuzao'), ('cuzão'), ('babaca'), ('idiota'),
  ('retardado'), ('retardada'), ('imbecil'), ('otario'), ('otário'), ('otaria'), ('otária'),
  ('fdp'), ('fodase'), ('foda-se'),
  ('fuck'), ('fucking'), ('shit'), ('bitch'), ('asshole'), ('bastard'),
  ('cunt'), ('faggot'), ('nigger'), ('retard'), ('whore'), ('slut')
on conflict (word) do nothing;

create table if not exists chat_messages (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references teams(id) on delete cascade,
  team_name  text not null,
  tier       text not null check (tier in
               ('Bronze','Prata','Ouro','Platina','Diamante','Mestre','Grão-Mestre')),
  message    text not null,
  created_at timestamptz not null default now()
);

alter table chat_messages enable row level security;

-- Só vê mensagens do próprio elo — não é dado sensível, mas não faz sentido misturar chats de
-- elos diferentes (nem no client, nem no que o Realtime broadcasta).
create policy "Users can view chat messages from their own tier"
  on chat_messages for select
  to authenticated
  using (tier = (select tier_for_pdl(pdl) from teams where user_id = auth.uid()));

-- Sem policy de insert -> só send_chat_message() grava aqui (é isso que faz o filtro valer).

create index if not exists chat_messages_tier_created_idx
  on chat_messages (tier, created_at desc);

alter table teams add column if not exists last_chat_message_at timestamptz;

-- Habilita Realtime nessa tabela (INSERTs passam a ser transmitidos via websocket).
alter publication supabase_realtime add table chat_messages;

-- ── filter_offensive_words(): substitui cada palavra banida por asteriscos do mesmo tamanho ─
-- Não é exposta pro client (EXECUTE revogado) — só send_chat_message() chama.
create or replace function filter_offensive_words(p_text text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_word   text;
  v_result text := p_text;
begin
  for v_word in select word from banned_words loop
    v_result := regexp_replace(v_result, '(?i)\y' || v_word || '\y', repeat('*', length(v_word)), 'g');
  end loop;
  return v_result;
end;
$$;

revoke execute on function filter_offensive_words(text) from public, authenticated, anon;

-- ── send_chat_message(): única forma de gravar em chat_messages ────────────────────────────
create or replace function send_chat_message(p_message text)
returns chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team teams%rowtype;
  v_tier text;
  v_clean text;
  v_row  chat_messages%rowtype;
begin
  select * into v_team from teams where user_id = auth.uid();
  if not found then
    raise exception 'team_not_found';
  end if;

  if v_team.last_chat_message_at is not null and v_team.last_chat_message_at > now() - interval '2 seconds' then
    raise exception 'rate_limited';
  end if;

  if length(trim(p_message)) = 0 then
    raise exception 'empty_message';
  end if;

  if length(p_message) > 300 then
    raise exception 'message_too_long';
  end if;

  v_tier  := tier_for_pdl(v_team.pdl);
  v_clean := filter_offensive_words(p_message);

  insert into chat_messages (team_id, team_name, tier, message)
  values (v_team.id, v_team.name, v_tier, v_clean)
  returning * into v_row;

  update teams set last_chat_message_at = now() where id = v_team.id;

  return v_row;
end;
$$;

grant execute on function send_chat_message(text) to authenticated;
