-- Migration 048: Corrige IDOR em buy_player_direct (comprador podia ser qualquer time)
-- Run this AFTER migration 047
--
-- Vulnerabilidade corrigida:
--  `buy_player_direct` (020) recebe `p_buyer_team_id` do client e nunca conferia se esse time
--  pertence de fato a quem está chamando (auth.uid()). Como toda RPC econômica do projeto
--  deriva o time do chamador via `teams where user_id = auth.uid()` (ver `place_bid`,
--  `resolve_match`, `sign_free_agent`), esta função quebrava o padrão: qualquer usuário
--  autenticado podia chamar supabase.rpc('buy_player_direct', { p_buyer_team_id: <time de
--  outra pessoa> }) direto na REST API e debitar o orçamento de um time-vítima, transferindo
--  o jogador comprado para o roster dele — sem nunca ter sido o dono daquele time.

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
  -- Confere que quem está chamando é de fato o dono do time comprador
  if not exists (
    select 1 from teams where id = p_buyer_team_id and user_id = auth.uid()
  ) then
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
