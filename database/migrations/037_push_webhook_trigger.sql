-- Migration 037: Trigger em SQL pra disparar o push (alternativa ao Database Webhook do painel)
-- Run this AFTER migration 036
--
-- A ideia original era configurar isso via painel (Database > Webhooks), mas a localização
-- desse menu varia entre versões da UI do Supabase. Esta migration faz a mesma coisa 100% em
-- SQL: um trigger que roda depois de todo INSERT em `notifications` e chama a Edge Function
-- `send-push-notification` via `pg_net` (extensão HTTP assíncrona já disponível no Supabase).
--
-- IMPORTANTE: essa migration sozinha NÃO ativa o push ainda — o valor real do
-- PUSH_WEBHOOK_SECRET não fica aqui (esse arquivo vai pro Git). Depois de rodar isso, rode
-- TAMBÉM o comando abaixo no SQL Editor, com seu secret de verdade, SEM commitar num arquivo:
--
--   alter database postgres set app.settings.push_webhook_secret = 'cole_aqui_o_mesmo_valor_do_PUSH_WEBHOOK_SECRET';
--
-- (mesmo valor que você já rodou em `supabase secrets set PUSH_WEBHOOK_SECRET=...` pra Edge
-- Function — os dois lados têm que bater).

create extension if not exists pg_net with schema extensions;

create or replace function trigger_send_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  v_secret := current_setting('app.settings.push_webhook_secret', true);
  if v_secret is null or v_secret = '' then
    -- Ainda não configurado (ver instrução no topo desta migration) — não quebra o INSERT,
    -- só não dispara o push.
    return new;
  end if;

  perform net.http_post(
    url := 'https://rxjqzosdtpnvpgeximgw.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'record', to_jsonb(new)
    )
  );

  return new;
end;
$$;

drop trigger if exists on_notification_insert_push on notifications;

create trigger on_notification_insert_push
  after insert on notifications
  for each row execute function trigger_send_push_notification();
