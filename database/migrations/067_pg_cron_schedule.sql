-- Migration 067: Ativação do pg_cron e agendamento dos 4 jobs do motor de partidas
-- Run this AFTER migration 066
--
-- Primeira vez que o projeto sai do padrão "lazy-cron" documentado na migration 019 ("não há
-- pg_cron configurado neste projeto") — partida autônoma exige progressão orientada por
-- servidor, independente de qualquer client aberto. Os 4 jobs só chamam funções `system_*`
-- (migration 065), que já têm EXECUTE revogado de authenticated/anon — o pg_cron roda como
-- `postgres` (role que agendou o job ao rodar esta migration), mesmo privilégio que o trigger de
-- push (037/038) já usa hoje.
--
-- O formato de intervalo em segundos do pg_cron só aceita de 1 a 59 segundos (erro "invalid
-- schedule" pra 60+) — pra rodar a cada 1 minuto (match-kickoff) usa-se a sintaxe cron de 5
-- campos (`'* * * * *'`) em vez de `'60 seconds'`.
--
-- Se a versão de pg_cron provisionada pela Supabase não suportar NEM o agendamento por intervalo
-- em segundos (sintaxe disponível a partir da 1.4 do pg_cron), os `cron.schedule(name, interval,
-- command)` abaixo falham na primeira chamada — nesse caso, trocar os intervalos restantes
-- também pela sintaxe cron de 5 campos de 1 minuto e mover o espaçamento fino (5-8s) pra um
-- `pg_sleep` dentro de um loop na própria função `system_*`, sem mudar mais nada da arquitetura.

create extension if not exists pg_cron with schema extensions;

-- Remove agendamentos antigos com o mesmo nome antes de recriar -> migration fica re-executável
-- sem duplicar job (cron.unschedule não falha se a linha não existir, só não faz nada).
select cron.unschedule(jobid) from cron.job where jobname = 'match-matchmaking-tick';
select cron.unschedule(jobid) from cron.job where jobname = 'match-kickoff';
select cron.unschedule(jobid) from cron.job where jobname = 'match-reveal-tick';
select cron.unschedule(jobid) from cron.job where jobname = 'match-finalize';

select cron.schedule(
  'match-matchmaking-tick', '30 seconds',
  $$ select system_match_matchmaking_tick(); $$
);

select cron.schedule(
  'match-kickoff', '* * * * *',
  $$ select system_kickoff_due_sessions(); $$
);

select cron.schedule(
  'match-reveal-tick', '7 seconds',
  $$ select system_reveal_match_ticks(); $$
);

select cron.schedule(
  'match-finalize', '15 seconds',
  $$ select system_finalize_matches(); $$
);
