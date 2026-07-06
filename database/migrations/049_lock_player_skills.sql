-- Migration 049: Bloqueia escrita direta do client em player_skills
-- Run this AFTER migration 048
--
-- Vulnerabilidade corrigida:
--  A policy "Users can manage skills of their own players" (003) é `for all using (...)`
--  sem `with check` de valor — ela só confere se o jogador pertence ao usuário, nunca o
--  que está sendo escrito. Como nenhuma migration jamais revogou o grant de tabela, um
--  usuário autenticado podia chamar
--    supabase.from('player_skills').update({ value: 100 }).eq('player_id', meuJogador)
--  direto na REST API e maxar qualquer atributo (aim, precisao, leitura, decisao, etc.)
--  de graça, pulando o custo de energia/tempo do sistema de treino real (027) — e
--  inflando os atributos exibidos na tela de mercado antes de vender o jogador.
--
--  Daqui pra frente, o único caminho para alterar `player_skills.value` é a função
--  SECURITY DEFINER `claim_completed_training` (027), que já aplica os deltas de treino
--  corretamente. A trigger de criação de jogadores iniciais (004) e `sign_free_agent` (026)
--  continuam funcionando pois rodam como SECURITY DEFINER (dono da função, não do caller).

revoke insert, update, delete on player_skills from authenticated;
