-- Migration 020: Corrige IDOR em listagens de leilão + validações faltantes na compra direta
-- Run this AFTER migration 019
--
-- Vulnerabilidades corrigidas:
--  1. A policy de INSERT em `auctions` (012) só verificava o dono de `seller_team_id`, nunca
--     se `player_id` pertence de fato a esse time. Como os leilões ativos são públicos
--     (player_id embutido no join), qualquer usuário podia listar o jogador de OUTRO time e
--     embolsar o pagamento quando alguém comprasse — o dono de verdade perdia o jogador sem
--     receber nada.
--  2. `buy_player_direct` (016) não conferia saldo do comprador antes de debitar (permitia
--     orçamento negativo) nem revalidava, no momento da compra, se o vendedor ainda era o
--     dono do jogador (defesa em profundidade contra o mesmo IDOR do item 1, e contra o
--     jogador ter sido transferido por outro caminho entre o anúncio e a compra).
--  3. `settle_expired_auctions` (019) tinha a mesma lacuna de revalidação de dono do item 2.

-- ── 1. auctions: só posso anunciar jogador que realmente está no meu time ───────────────────
drop policy if exists "Teams can create auctions for their players" on auctions;

create policy "Teams can create auctions for their own players"
  on auctions for insert
  to authenticated
  with check (
    seller_team_id in (select id from teams where user_id = auth.uid())
    and exists (
      select 1 from players p
      where p.id = player_id and p.team_id = seller_team_id
    )
  );

-- ── 2. buy_player_direct: confere saldo do comprador e dono atual do jogador ─────────────────
create or replace function buy_player_direct(
  p_listing_id    uuid,
  p_buyer_team_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing      auctions%rowtype;
  v_buyer_budget integer;
begin
  select * into v_listing
    from auctions
   where id = p_listing_id
     and status = 'active'
     and listing_type = 'direct_sale'
   for update;

  if not found then
    raise exception 'listing_not_available';
  end if;

  if v_listing.seller_team_id = p_buyer_team_id then
    raise exception 'cannot_buy_own_player';
  end if;

  -- Confirma que o vendedor ainda é o dono do jogador (defesa contra listagem fraudulenta
  -- ou transferência por outro caminho entre o anúncio e a compra)
  if not exists (
    select 1 from players where id = v_listing.player_id and team_id = v_listing.seller_team_id
  ) then
    update auctions set status = 'cancelled' where id = p_listing_id;
    raise exception 'listing_not_available';
  end if;

  select budget into v_buyer_budget from teams where id = p_buyer_team_id;
  if v_buyer_budget is null or v_buyer_budget < v_listing.sale_price then
    raise exception 'insufficient_budget';
  end if;

  update auctions
     set status = 'ended', current_bidder_team_id = p_buyer_team_id
   where id = p_listing_id;

  update players
     set team_id = p_buyer_team_id
   where id = v_listing.player_id;

  update teams
     set budget = budget - v_listing.sale_price
   where id = p_buyer_team_id;

  update teams
     set budget = budget + v_listing.sale_price
   where id = v_listing.seller_team_id;
end;
$$;

grant execute on function buy_player_direct(uuid, uuid) to authenticated;

-- ── 3. settle_expired_auctions: mesma revalidação de dono antes de transferir ───────────────
create or replace function settle_expired_auctions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing       auctions%rowtype;
  v_bidder_budget integer;
begin
  for v_listing in
    select * from auctions
    where status = 'active'
      and listing_type = 'auction'
      and ends_at <= now()
    for update skip locked
  loop
    if v_listing.current_bidder_team_id is null then
      update auctions set status = 'cancelled' where id = v_listing.id;
      continue;
    end if;

    -- Vendedor precisa ainda ser o dono do jogador
    if not exists (
      select 1 from players where id = v_listing.player_id and team_id = v_listing.seller_team_id
    ) then
      update auctions set status = 'cancelled' where id = v_listing.id;
      continue;
    end if;

    select budget into v_bidder_budget
      from teams where id = v_listing.current_bidder_team_id;

    if v_bidder_budget is null or v_bidder_budget < v_listing.current_bid then
      update auctions set status = 'cancelled' where id = v_listing.id;
      continue;
    end if;

    update auctions set status = 'ended' where id = v_listing.id;

    update players
      set team_id = v_listing.current_bidder_team_id
      where id = v_listing.player_id;

    update teams
      set budget = budget - v_listing.current_bid
      where id = v_listing.current_bidder_team_id;

    update teams
      set budget = budget + v_listing.current_bid
      where id = v_listing.seller_team_id;
  end loop;
end;
$$;

grant execute on function settle_expired_auctions() to authenticated;
