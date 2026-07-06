-- Migration 038: Guarda o PUSH_WEBHOOK_SECRET no Supabase Vault (em vez de app.settings)
-- Run this AFTER migration 037
--
-- `alter database ... set app.settings.push_webhook_secret = '...'` (migration 037) dá
-- "permission denied" no Postgres gerenciado do Supabase — a role do SQL Editor não tem
-- privilégio de superusuário pra isso. O Vault é o mecanismo que o Supabase disponibiliza
-- justamente pra guardar segredos acessíveis de dentro de uma function/trigger SQL sem precisar
-- de ALTER DATABASE.
--
-- Depois de rodar esta migration, guarde o secret rodando isto no SQL Editor (troque pelo MESMO
-- valor que você já usou em `supabase secrets set PUSH_WEBHOOK_SECRET=...`):
--
--   select vault.create_secret('cole_aqui_o_mesmo_valor_do_PUSH_WEBHOOK_SECRET', 'push_webhook_secret');
--
-- Se precisar trocar o valor depois, use `select vault.update_secret(...)` (veja os docs do
-- Supabase Vault) em vez de rodar create_secret de novo, senão fica um registro duplicado.

create or replace function trigger_send_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'push_webhook_secret'
    limit 1;

  if v_secret is null or v_secret = '' then
    -- Ainda não guardado no Vault (ver instrução no topo desta migration) — não quebra o
    -- INSERT, só não dispara o push.
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
