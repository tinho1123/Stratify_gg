-- Migration 059: Escudo de guilda — coluna equipped_cosmetics, ledger de posse e catálogo
-- Run this AFTER migration 058
--
-- Espelha o padrão de escudo de time (migration 057), mas com ledger e categorias próprias:
-- guildas não têm carteira própria, então a compra sempre debita do time líder (mesmo padrão
-- de create_guild, migration 054) — por isso as peças de guilda não compartilham categoria nem
-- ledger com as de time (a RPC de compra, na migration 060, precisa saber só pela categoria de
-- qual carteira debitar e em qual tabela registrar a posse).

alter table guilds add column if not exists equipped_cosmetics jsonb not null default '{}'::jsonb;

create table if not exists guild_cosmetics (
  guild_id     uuid not null references guilds(id) on delete cascade,
  cosmetic_id  uuid not null references cosmetics(id) on delete cascade,
  purchased_at timestamptz not null default now(),
  primary key (guild_id, cosmetic_id)
);

alter table guild_cosmetics enable row level security;

create policy "Guild members can view their guild's cosmetics"
  on guild_cosmetics for select
  to authenticated
  using (
    guild_id in (
      select gm.guild_id from guild_members gm
      join teams t on t.id = gm.team_id
      where t.user_id = auth.uid()
    )
  );

-- Sem policy de insert/update/delete -> só as funções SECURITY DEFINER da migration 060
-- escrevem aqui.

alter table cosmetics drop constraint if exists cosmetics_category_check;
alter table cosmetics add constraint cosmetics_category_check
  check (category in (
    'name_color', 'player_frame',
    'shield_shape', 'shield_primary_color', 'shield_secondary_color', 'shield_icon',
    'guild_shield_shape', 'guild_shield_primary_color', 'guild_shield_secondary_color', 'guild_shield_icon'
  ));

insert into cosmetics (key, category, name, description, price_credits, preview) values
  -- Formas
  ('guild_shield_shape_classic', 'guild_shield_shape', 'Clássico',   'Formato tradicional de escudo de futebol.', 0,   '{"ref": "classic"}'),
  ('guild_shield_shape_circle',  'guild_shield_shape', 'Circular',   'Escudo redondo.',                            0,   '{"ref": "circle"}'),
  ('guild_shield_shape_hexagon', 'guild_shield_shape', 'Hexágono',   'Escudo em formato de hexágono.',              400, '{"ref": "hexagon"}'),
  ('guild_shield_shape_pennant', 'guild_shield_shape', 'Bandeirola', 'Escudo em formato de bandeirola.',            400, '{"ref": "pennant"}'),
  ('guild_shield_shape_arch',    'guild_shield_shape', 'Arco',       'Escudo com topo em arco.',                    600, '{"ref": "arch"}'),

  -- Cor primária
  ('guild_shield_primary_black',    'guild_shield_primary_color', 'Preto',      'Cor de fundo do escudo da guilda.', 0,   '{"color": "#0D0D0D"}'),
  ('guild_shield_primary_white',    'guild_shield_primary_color', 'Branco',     'Cor de fundo do escudo da guilda.', 0,   '{"color": "#F5F5F5"}'),
  ('guild_shield_primary_gold',     'guild_shield_primary_color', 'Dourado',    'Cor de fundo do escudo da guilda.', 500, '{"color": "#F59E0B"}'),
  ('guild_shield_primary_emerald',  'guild_shield_primary_color', 'Esmeralda',  'Cor de fundo do escudo da guilda.', 500, '{"color": "#10B981"}'),
  ('guild_shield_primary_amethyst', 'guild_shield_primary_color', 'Ametista',   'Cor de fundo do escudo da guilda.', 500, '{"color": "#A855F7"}'),
  ('guild_shield_primary_crimson',  'guild_shield_primary_color', 'Carmesim',   'Cor de fundo do escudo da guilda.', 500, '{"color": "#EF4444"}'),
  ('guild_shield_primary_royal',    'guild_shield_primary_color', 'Azul Royal', 'Cor de fundo do escudo da guilda.', 500, '{"color": "#3B82F6"}'),

  -- Cor secundária
  ('guild_shield_secondary_black',    'guild_shield_secondary_color', 'Preto',      'Cor de borda e detalhe do escudo da guilda.', 0,   '{"color": "#0D0D0D"}'),
  ('guild_shield_secondary_white',    'guild_shield_secondary_color', 'Branco',     'Cor de borda e detalhe do escudo da guilda.', 0,   '{"color": "#F5F5F5"}'),
  ('guild_shield_secondary_gold',     'guild_shield_secondary_color', 'Dourado',    'Cor de borda e detalhe do escudo da guilda.', 500, '{"color": "#F59E0B"}'),
  ('guild_shield_secondary_emerald',  'guild_shield_secondary_color', 'Esmeralda',  'Cor de borda e detalhe do escudo da guilda.', 500, '{"color": "#10B981"}'),
  ('guild_shield_secondary_amethyst', 'guild_shield_secondary_color', 'Ametista',   'Cor de borda e detalhe do escudo da guilda.', 500, '{"color": "#A855F7"}'),
  ('guild_shield_secondary_crimson',  'guild_shield_secondary_color', 'Carmesim',   'Cor de borda e detalhe do escudo da guilda.', 500, '{"color": "#EF4444"}'),
  ('guild_shield_secondary_royal',    'guild_shield_secondary_color', 'Azul Royal', 'Cor de borda e detalhe do escudo da guilda.', 500, '{"color": "#3B82F6"}'),

  -- Ícones
  ('guild_shield_icon_star',   'guild_shield_icon', 'Estrela', 'Emblema central do escudo da guilda.', 0,   '{"ref": "star"}'),
  ('guild_shield_icon_ball',   'guild_shield_icon', 'Bola',    'Emblema central do escudo da guilda.', 0,   '{"ref": "ball"}'),
  ('guild_shield_icon_bolt',   'guild_shield_icon', 'Raio',    'Emblema central do escudo da guilda.', 400, '{"ref": "bolt"}'),
  ('guild_shield_icon_skull',  'guild_shield_icon', 'Caveira', 'Emblema central do escudo da guilda.', 400, '{"ref": "skull"}'),
  ('guild_shield_icon_crown',  'guild_shield_icon', 'Coroa',   'Emblema central do escudo da guilda.', 500, '{"ref": "crown"}'),
  ('guild_shield_icon_claw',   'guild_shield_icon', 'Garra',   'Emblema central do escudo da guilda.', 400, '{"ref": "claw"}'),
  ('guild_shield_icon_sword',  'guild_shield_icon', 'Espada',  'Emblema central do escudo da guilda.', 400, '{"ref": "sword"}'),
  ('guild_shield_icon_wings',  'guild_shield_icon', 'Asas',    'Emblema central do escudo da guilda.', 500, '{"ref": "wings"}'),
  ('guild_shield_icon_dragon', 'guild_shield_icon', 'Dragão',  'Emblema central do escudo da guilda.', 800, '{"ref": "dragon"}')
on conflict (key) do nothing;
