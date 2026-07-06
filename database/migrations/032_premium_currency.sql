-- Migration 032: Moeda premium (créditos) + loja de cosméticos + ledger de compras via IAP
-- Run this AFTER migration 031
--
-- Implementa a Fase 1 do plano de monetização: uma moeda premium comprada com dinheiro real
-- (via App Store/Google Play, processada pelo RevenueCat) gasta em cosméticos que NÃO afetam
-- economia/ranking (budget, pdl, wins, losses, rating, skills) — só aparência.
--
-- Segue a mesma regra de ouro do resto do projeto: o client nunca escreve `premium_credits`
-- direto. A concessão de créditos por compra real só acontece via `redeem_iap_purchase`, chamada
-- pelo webhook do RevenueCat (Supabase Edge Function rodando com a service role key, nunca pelo
-- client) — por isso essa função tem EXECUTE revogado de authenticated/anon. Gastar créditos em
-- cosméticos (`purchase_cosmetic`) e trocar o equipado (`equip_cosmetic`/`unequip_cosmetic`) são
-- as únicas ações que o client pode disparar diretamente, e mesmo essas são validadas no servidor.

-- ── 1. Créditos premium + cosméticos equipados na própria tabela teams ──────────────────────
-- Novas colunas: como o UPDATE de `teams` já é restringido por grant de coluna (migration 017,
-- só libera name/onboarded), estas duas colunas ficam automaticamente fora do alcance do client
-- (não precisam de revoke adicional — só não entram na lista de colunas liberadas).
alter table teams add column if not exists premium_credits integer not null default 0;
alter table teams add column if not exists equipped_cosmetics jsonb not null default '{}'::jsonb;

-- ── 2. Catálogo de pacotes de créditos (mapeia product_id do RevenueCat -> quantidade) ──────
-- Fonte única de verdade de "quantos créditos esse produto dá" — usada tanto pela UI da loja
-- (pra listar os pacotes) quanto pelo webhook (pra decidir quanto creditar), nunca confiando em
-- um valor vindo do client ou do payload do webhook.
create table if not exists credit_products (
  product_id  text primary key,   -- precisa bater com o Product ID configurado na App Store
                                   -- Connect / Google Play Console / RevenueCat
  credits     integer not null check (credits > 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table credit_products enable row level security;

create policy "Anyone authenticated can view credit products"
  on credit_products for select
  to authenticated
  using (is_active);

insert into credit_products (product_id, credits) values
  ('stratify_credits_small',  300),
  ('stratify_credits_medium', 550),
  ('stratify_credits_large',  1200),
  ('stratify_credits_mega',   2800)
on conflict (product_id) do nothing;

-- ── 3. Catálogo de cosméticos ────────────────────────────────────────────────────────────────
create table if not exists cosmetics (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,
  category       text not null check (category in ('name_color', 'player_frame')),
  name           text not null,
  description    text,
  price_credits  integer not null check (price_credits > 0),
  preview        jsonb not null default '{}'::jsonb, -- ex.: {"color": "#F59E0B"}
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

alter table cosmetics enable row level security;

create policy "Anyone authenticated can view active cosmetics"
  on cosmetics for select
  to authenticated
  using (is_active);

insert into cosmetics (key, category, name, description, price_credits, preview) values
  ('name_gold',     'name_color',   'Nome Dourado',      'Destaque seu nome na classificação da liga.', 300,  '{"color": "#F59E0B"}'),
  ('name_emerald',  'name_color',   'Nome Esmeralda',    'Destaque seu nome na classificação da liga.', 300,  '{"color": "#10B981"}'),
  ('name_amethyst', 'name_color',   'Nome Ametista',     'Destaque seu nome na classificação da liga.', 300,  '{"color": "#A855F7"}'),
  ('frame_silver',  'player_frame', 'Moldura Prata',     'Nova moldura para os avatares dos jogadores.', 400,  '{"color": "#D1D5DB"}'),
  ('frame_gold',    'player_frame', 'Moldura Ouro',      'Nova moldura para os avatares dos jogadores.', 700,  '{"color": "#F59E0B"}'),
  ('frame_diamond', 'player_frame', 'Moldura Diamante',  'Nova moldura para os avatares dos jogadores.', 1200, '{"color": "#60A5FA"}')
on conflict (key) do nothing;

-- ── 4. Cosméticos comprados por time ─────────────────────────────────────────────────────────
create table if not exists team_cosmetics (
  team_id      uuid not null references teams(id) on delete cascade,
  cosmetic_id  uuid not null references cosmetics(id) on delete cascade,
  purchased_at timestamptz not null default now(),
  primary key (team_id, cosmetic_id)
);

alter table team_cosmetics enable row level security;

create policy "Users can view their own team's cosmetics"
  on team_cosmetics for select
  to authenticated
  using (team_id in (select id from teams where user_id = auth.uid()));

-- Sem policy de insert/update/delete -> só as funções SECURITY DEFINER abaixo escrevem aqui.

-- ── 5. Ledger de compras via IAP (idempotência do webhook) ──────────────────────────────────
create table if not exists premium_purchases (
  id                       uuid primary key default gen_random_uuid(),
  team_id                  uuid not null references teams(id) on delete cascade,
  product_id               text not null references credit_products(product_id),
  credits_granted          integer not null,
  revenuecat_transaction_id text not null unique,
  created_at               timestamptz not null default now()
);

alter table premium_purchases enable row level security;

create policy "Users can view their own purchase history"
  on premium_purchases for select
  to authenticated
  using (team_id in (select id from teams where user_id = auth.uid()));

-- ── 6. redeem_iap_purchase: só o webhook do RevenueCat chama isso (via service role) ────────
-- Não recebe auth.uid() porque quem chama é o servidor (Edge Function), não o usuário logado —
-- por isso recebe p_team_id explícito e tem EXECUTE revogado de authenticated/anon: nenhum
-- client autenticado consegue chamar isso direto pra se autopresentear com créditos.
create or replace function redeem_iap_purchase(
  p_team_id      uuid,
  p_product_id   text,
  p_transaction_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits  integer;
  v_inserted integer;
begin
  select credits into v_credits from credit_products where product_id = p_product_id and is_active;
  if v_credits is null then
    raise exception 'unknown_product: %', p_product_id;
  end if;

  insert into premium_purchases (team_id, product_id, credits_granted, revenuecat_transaction_id)
  values (p_team_id, p_product_id, v_credits, p_transaction_id)
  on conflict (revenuecat_transaction_id) do nothing;
  get diagnostics v_inserted = row_count;

  -- RevenueCat pode reenviar o mesmo evento de webhook mais de uma vez — idempotente, não
  -- credita de novo se essa transação já foi processada.
  if v_inserted = 0 then
    return;
  end if;

  update teams set premium_credits = premium_credits + v_credits where id = p_team_id;
end;
$$;

revoke execute on function redeem_iap_purchase(uuid, text, text) from public, authenticated, anon;

-- ── 7. purchase_cosmetic: gasta créditos, dá pro client via authenticated normalmente ───────
create or replace function purchase_cosmetic(p_cosmetic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id  uuid;
  v_credits  integer;
  v_price    integer;
  v_active   boolean;
begin
  select id, premium_credits into v_team_id, v_credits from teams where user_id = auth.uid();
  if v_team_id is null then
    raise exception 'team_not_found';
  end if;

  select price_credits, is_active into v_price, v_active from cosmetics where id = p_cosmetic_id;
  if v_price is null then
    raise exception 'cosmetic_not_found';
  end if;
  if not v_active then
    raise exception 'cosmetic_unavailable';
  end if;

  if exists (select 1 from team_cosmetics where team_id = v_team_id and cosmetic_id = p_cosmetic_id) then
    raise exception 'already_owned';
  end if;

  if v_credits < v_price then
    raise exception 'insufficient_credits';
  end if;

  update teams set premium_credits = premium_credits - v_price where id = v_team_id;
  insert into team_cosmetics (team_id, cosmetic_id) values (v_team_id, p_cosmetic_id);

  return jsonb_build_object('remaining_credits', v_credits - v_price);
end;
$$;

grant execute on function purchase_cosmetic(uuid) to authenticated;

-- ── 8. equip_cosmetic / unequip_cosmetic ────────────────────────────────────────────────────
create or replace function equip_cosmetic(p_cosmetic_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id  uuid;
  v_category text;
begin
  select id into v_team_id from teams where user_id = auth.uid();
  if v_team_id is null then
    raise exception 'team_not_found';
  end if;

  select category into v_category from cosmetics where id = p_cosmetic_id and is_active;
  if v_category is null then
    raise exception 'cosmetic_not_found';
  end if;

  if not exists (select 1 from team_cosmetics where team_id = v_team_id and cosmetic_id = p_cosmetic_id) then
    raise exception 'not_owned';
  end if;

  update teams
    set equipped_cosmetics = jsonb_set(equipped_cosmetics, array[v_category], to_jsonb(p_cosmetic_id::text), true)
    where id = v_team_id;
end;
$$;

grant execute on function equip_cosmetic(uuid) to authenticated;

create or replace function unequip_cosmetic(p_category text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  select id into v_team_id from teams where user_id = auth.uid();
  if v_team_id is null then
    raise exception 'team_not_found';
  end if;

  update teams set equipped_cosmetics = equipped_cosmetics - p_category where id = v_team_id;
end;
$$;

grant execute on function unequip_cosmetic(text) to authenticated;
