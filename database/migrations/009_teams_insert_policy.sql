-- Migration 009: Adicionar policy de INSERT na tabela teams
-- Necessário para o upsert do setup/team funcionar caso o trigger não tenha criado o time
-- Run this AFTER migration 008

create policy "Users can insert their own team"
  on teams for insert
  to authenticated
  with check (user_id = auth.uid());
