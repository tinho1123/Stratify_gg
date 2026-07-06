-- Migration 051: Corrige transferência de posse de jogador em compra/leilão
-- Run this AFTER migration 050
--
-- Vulnerabilidade corrigida (revisão de código externa):
--  `buy_player_direct` (048) e `settle_expired_auctions` (019) só atualizavam
--  `players.team_id` ao transferir um jogador comprado/arrematado. A RLS de `players`
--  (003_add_user_id_to_players.sql) filtra select/update por `user_id = auth.uid()`, não por
--  `team_id`. Resultado: o comprador pagava o preço, o orçamento era debitado, mas o jogador
--  continuava invisível/não editável para ele (user_id ainda apontava para o vendedor) — e o
--  vendedor, que não é mais dono, continuava enxergando o jogador nas próprias queries.

create or replace function buy_player_direct(
  p_listing_id    uuid,
  p_buyer_team_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing       auctions%rowtype;
  v_buyer_budget  integer;
  v_buyer_user_id uuid;
begin
  -- Confere que quem está chamando é de fato o dono do time comprador
  select user_id into v_buyer_user_id
    from teams where id = p_buyer_team_id and user_id = auth.uid();

  if v_buyer_user_id is null then
    raise exception 'not_your_team';
  end if;

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
     set team_id = p_buyer_team_id,
         user_id = v_buyer_user_id
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

-- ── settle_expired_auctions(): mesma correção para leilões por lance ────────────────────────
create or replace function settle_expired_auctions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing        auctions%rowtype;
  v_bidder_budget  integer;
  v_bidder_user_id uuid;
begin
  for v_listing in
    select * from auctions
    where status = 'active'
      and listing_type = 'auction'
      and ends_at <= now()
    for update skip locked
  loop
    -- Ninguém deu lance: encerra sem vencedor, jogador continua com o vendedor
    if v_listing.current_bidder_team_id is null then
      update auctions set status = 'cancelled' where id = v_listing.id;
      continue;
    end if;

    -- Reconfere o saldo do maior lance no momento do fechamento (pode ter mudado desde o
    -- lance, ex.: o time gastou o orçamento em outra compra nesse meio tempo)
    select budget, user_id into v_bidder_budget, v_bidder_user_id
      from teams where id = v_listing.current_bidder_team_id;

    if v_bidder_budget is null or v_bidder_budget < v_listing.current_bid then
      update auctions set status = 'cancelled' where id = v_listing.id;
      continue;
    end if;

    update auctions set status = 'ended' where id = v_listing.id;

    update players
      set team_id = v_listing.current_bidder_team_id,
          user_id = v_bidder_user_id
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
