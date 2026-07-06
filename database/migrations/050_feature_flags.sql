-- Migration 050: Feature flags remotas para lançamento gradual
--
-- Objetivo: várias telas (tactics, training, chat, matches/challenges,
-- matches/live, matches/season, matches/tournament) ainda são parciais/stub.
-- Em vez de esperar todas ficarem prontas para lançar, esta tabela permite
-- esconder cada uma no app e liberá-la depois trocando um valor no banco —
-- sem precisar de novo build nem review de loja.
--
-- Não é dado de economia/ranking (não é budget, pdl, wins, etc.), mas mesmo
-- assim o client nunca deve poder escrever aqui: se pudesse, um usuário
-- malicioso ligaria pra si mesmo uma feature ainda incompleta direto pela
-- REST API. Por isso: só SELECT é liberado para authenticated, e
-- insert/update/delete são revogados — a única forma de mudar uma flag é
-- pelo dashboard do Supabase (ou service role).

create table if not exists feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  updated_at  timestamptz not null default now()
);

alter table feature_flags enable row level security;

create policy "feature_flags_select_authenticated"
  on feature_flags for select
  to authenticated
  using (true);

revoke insert, update, delete on feature_flags from authenticated, anon;

-- Só existem linhas para as features que devem começar escondidas. Telas
-- funcionais (home, manage_team, market, matches, profile, achievements,
-- ranking, messages, store) não têm flag — nunca são gateadas no client,
-- então uma tabela vazia ou indisponível nunca as esconde por engano.
--
-- matches/live NÃO entra aqui: apesar de a apresentação (kill feed, animações)
-- ainda não estar 100%, é essa tela que chama a RPC `resolve_match` — é o único
-- caminho para resolver uma partida. Escondê-la travaria o loop principal do
-- jogo (partida nunca resolve, próxima nunca gera), então ela vai sempre
-- habilitada.
insert into feature_flags (key, enabled, description) values
  ('tactics',             false, 'Tela de táticas'),
  ('training',            false, 'Módulo de treino'),
  ('chat',                false, 'Chat do time'),
  ('matches_challenges',  false, 'Desafios entre times'),
  ('matches_season',      false, 'Temporada / battle pass'),
  ('matches_tournament',  false, 'Torneios')
on conflict (key) do nothing;
