-- Migration 057: Escudo de time — categorias de cosmético (forma, cores, ícone) + catálogo inicial
-- Run this AFTER migration 056
--
-- Reaproveita a infraestrutura de cosméticos da migration 032 (`cosmetics` + `team_cosmetics` +
-- `teams.equipped_cosmetics`) em vez de criar tabelas novas. O escudo de time é montado a partir
-- de 4 peças independentes (forma, cor primária, cor secundária, ícone), cada uma um cosmético
-- comum, igual name_color/player_frame já são — mesma tabela, mesmo ledger de posse.
--
-- `preview` de forma/ícone guarda só uma referência (`{"ref": "..."}`), resolvida num registry
-- local no client (constants/shieldShapes.ts, constants/shieldIcons.ts) — o banco nunca guarda
-- o desenho em si (path SVG), só "qual peça". Cores seguem o padrão já existente ({"color": "#HEX"}).

alter table cosmetics drop constraint if exists cosmetics_category_check;
alter table cosmetics add constraint cosmetics_category_check
  check (category in (
    'name_color', 'player_frame',
    'shield_shape', 'shield_primary_color', 'shield_secondary_color', 'shield_icon'
  ));

-- Precisa permitir preço 0 -> cada categoria de escudo tem que ter pelo menos um item grátis,
-- senão o passo de onboarding ficaria esperando o jogador gastar diamantes antes de poder
-- confirmar. Preço 0 não significa "já possuído": ainda passa por purchase_cosmetic (que deduz
-- 0 créditos) pra registrar a posse em team_cosmetics, mesma trava de sempre.
alter table cosmetics drop constraint if exists cosmetics_price_credits_check;
alter table cosmetics add constraint cosmetics_price_credits_check
  check (price_credits >= 0);

insert into cosmetics (key, category, name, description, price_credits, preview) values
  -- Formas
  ('shield_shape_classic', 'shield_shape', 'Clássico',   'Formato tradicional de escudo de futebol.', 0,   '{"ref": "classic"}'),
  ('shield_shape_circle',  'shield_shape', 'Circular',   'Escudo redondo.',                            0,   '{"ref": "circle"}'),
  ('shield_shape_hexagon', 'shield_shape', 'Hexágono',   'Escudo em formato de hexágono.',              150, '{"ref": "hexagon"}'),
  ('shield_shape_pennant', 'shield_shape', 'Bandeirola', 'Escudo em formato de bandeirola.',            150, '{"ref": "pennant"}'),
  ('shield_shape_arch',    'shield_shape', 'Arco',       'Escudo com topo em arco.',                    250, '{"ref": "arch"}'),

  -- Cor primária (fundo do escudo)
  ('shield_primary_black',    'shield_primary_color', 'Preto',      'Cor de fundo do escudo.', 0,   '{"color": "#0D0D0D"}'),
  ('shield_primary_white',    'shield_primary_color', 'Branco',     'Cor de fundo do escudo.', 0,   '{"color": "#F5F5F5"}'),
  ('shield_primary_gold',     'shield_primary_color', 'Dourado',    'Cor de fundo do escudo.', 200, '{"color": "#F59E0B"}'),
  ('shield_primary_emerald',  'shield_primary_color', 'Esmeralda',  'Cor de fundo do escudo.', 200, '{"color": "#10B981"}'),
  ('shield_primary_amethyst', 'shield_primary_color', 'Ametista',   'Cor de fundo do escudo.', 200, '{"color": "#A855F7"}'),
  ('shield_primary_crimson',  'shield_primary_color', 'Carmesim',   'Cor de fundo do escudo.', 200, '{"color": "#EF4444"}'),
  ('shield_primary_royal',    'shield_primary_color', 'Azul Royal', 'Cor de fundo do escudo.', 200, '{"color": "#3B82F6"}'),

  -- Cor secundária (borda e ícone do escudo)
  ('shield_secondary_black',    'shield_secondary_color', 'Preto',      'Cor de borda e detalhe do escudo.', 0,   '{"color": "#0D0D0D"}'),
  ('shield_secondary_white',    'shield_secondary_color', 'Branco',     'Cor de borda e detalhe do escudo.', 0,   '{"color": "#F5F5F5"}'),
  ('shield_secondary_gold',     'shield_secondary_color', 'Dourado',    'Cor de borda e detalhe do escudo.', 200, '{"color": "#F59E0B"}'),
  ('shield_secondary_emerald',  'shield_secondary_color', 'Esmeralda',  'Cor de borda e detalhe do escudo.', 200, '{"color": "#10B981"}'),
  ('shield_secondary_amethyst', 'shield_secondary_color', 'Ametista',   'Cor de borda e detalhe do escudo.', 200, '{"color": "#A855F7"}'),
  ('shield_secondary_crimson',  'shield_secondary_color', 'Carmesim',   'Cor de borda e detalhe do escudo.', 200, '{"color": "#EF4444"}'),
  ('shield_secondary_royal',    'shield_secondary_color', 'Azul Royal', 'Cor de borda e detalhe do escudo.', 200, '{"color": "#3B82F6"}'),

  -- Ícones (emblema central)
  ('shield_icon_star',   'shield_icon', 'Estrela', 'Emblema central do escudo.', 0,   '{"ref": "star"}'),
  ('shield_icon_ball',   'shield_icon', 'Bola',    'Emblema central do escudo.', 0,   '{"ref": "ball"}'),
  ('shield_icon_bolt',   'shield_icon', 'Raio',    'Emblema central do escudo.', 150, '{"ref": "bolt"}'),
  ('shield_icon_skull',  'shield_icon', 'Caveira', 'Emblema central do escudo.', 150, '{"ref": "skull"}'),
  ('shield_icon_crown',  'shield_icon', 'Coroa',   'Emblema central do escudo.', 200, '{"ref": "crown"}'),
  ('shield_icon_claw',   'shield_icon', 'Garra',   'Emblema central do escudo.', 150, '{"ref": "claw"}'),
  ('shield_icon_sword',  'shield_icon', 'Espada',  'Emblema central do escudo.', 150, '{"ref": "sword"}'),
  ('shield_icon_wings',  'shield_icon', 'Asas',    'Emblema central do escudo.', 200, '{"ref": "wings"}'),
  ('shield_icon_dragon', 'shield_icon', 'Dragão',  'Emblema central do escudo.', 300, '{"ref": "dragon"}')
on conflict (key) do nothing;

-- purchase_cosmetic / equip_cosmetic / unequip_cosmetic (migration 032) não mudam de lógica —
-- já resolvem team_id via auth.uid() e validam categoria/posse/saldo genericamente por
-- `category`. Só a constraint acima muda; a RPC de equipagem coordenada das 4 peças do escudo
-- (equip_team_shield) vem na migration 058.
