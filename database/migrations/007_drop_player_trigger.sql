-- Migration 007: Remove trigger de criação de jogadores
-- A geração agora é feita no app (database/generateStarterPlayers.ts)
-- Run this AFTER migration 006

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists create_starter_players();
