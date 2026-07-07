-- Migration 055: Feature flag para a guilda (lançamento gradual)
-- Run this AFTER migration 054
--
-- Guildas (migrations 053/054) dependem de schema/RPCs novos que ainda não foram aplicados em
-- produção quando este código for publicado. Mesmo padrão de `tactics`/`training`/`chat`
-- (migration 050): a tela fica escondida no client até a flag ser ligada manualmente no
-- Supabase, depois que as migrations 053/054 já estiverem rodando — evita expor um botão que
-- chama RPC/tabela ainda inexistente pros usuários da build publicada.

insert into feature_flags (key, enabled, description) values
  ('guild', false, 'Guildas e ranking de guildas')
on conflict (key) do nothing;
