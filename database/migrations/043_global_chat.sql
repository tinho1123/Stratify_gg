-- Migration 043: Chat global (todos os times, independente do elo) + exibe elo e cosmético
-- (cor do nome) do time remetente
-- Run this AFTER migration 042
--
-- O chat deixa de ser filtrado por tier: agora é um único canal onde qualquer time autenticado
-- pode ler e escrever. Pra dar contexto de quem está falando sem expor a linha inteira de `teams`
-- (que só é visível pro próprio dono via RLS — migration 006), a gente denormaliza no INSERT
-- (mesmo padrão já usado pra `team_name` na migration 042): `team_pdl` (pra calcular elo/divisão
-- no client com `getTierInfo`, igual já é feito pro próprio time) e `name_color` (hex do cosmético
-- "name_color" equipado no momento do envio, resolvido no servidor a partir de
-- `cosmetics.preview->>'color'` — o client nunca lê a tabela `cosmetics`/`equipped_cosmetics` de
-- outro time, só recebe o hex já resolvido nessa coluna).

drop policy if exists "Users can view chat messages from their own tier" on chat_messages;

create policy "Any authenticated user can view chat messages"
  on chat_messages for select
  to authenticated
  using (true);

drop index if exists chat_messages_tier_created_idx;
create index if not exists chat_messages_created_idx on chat_messages (created_at desc);

alter table chat_messages drop column if exists tier;
alter table chat_messages add column if not exists team_pdl integer not null default 0;
alter table chat_messages add column if not exists name_color text;

-- ── send_chat_message(): agora grava num canal único, com pdl e cor do nome do time ──────────
create or replace function send_chat_message(p_message text)
returns chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team       teams%rowtype;
  v_clean      text;
  v_name_color text;
  v_row        chat_messages%rowtype;
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

  v_clean := filter_offensive_words(p_message);

  select c.preview->>'color' into v_name_color
    from cosmetics c
    where c.id = nullif(v_team.equipped_cosmetics->>'name_color', '')::uuid;

  insert into chat_messages (team_id, team_name, team_pdl, name_color, message)
  values (v_team.id, v_team.name, v_team.pdl, v_name_color, v_clean)
  returning * into v_row;

  update teams set last_chat_message_at = now() where id = v_team.id;

  return v_row;
end;
$$;

grant execute on function send_chat_message(text) to authenticated;
