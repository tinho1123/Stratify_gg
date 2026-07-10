-- Migration 064: collapse_key em notifications (pra push de partida se atualizar na bandeja)
-- Run this AFTER migration 063
--
-- As notificações de início/progresso/resultado de uma mesma partida (inseridas pelas funções
-- system_* na migration 065) compartilham um collapse_key (formato `match:<source>:<match_id>`)
-- repassado pela Edge Function `send-push-notification` no payload do Expo Push, pro sistema
-- operacional substituir a notificação anterior na bandeja em vez de empilhar uma nova a cada
-- atualização. Precisa existir ANTES das funções da migration 065, que já inserem usando essa
-- coluna.

alter table notifications add column if not exists collapse_key text;

create index if not exists notifications_collapse_key_idx
  on notifications (user_id, collapse_key) where collapse_key is not null;
