-- Migration 019: Fecha leilões por lance (listing_type = 'auction') quando o prazo vence
-- Run this AFTER migration 018
--
-- Hoje só existe liquidação para venda direta (`buy_player_direct`, migration 016). Leilões
-- por lance nunca fecham: `ends_at` passa e o anúncio continua "active" para sempre, sem
-- transferir o jogador nem cobrar o vencedor. Este arquivo adiciona `settle_expired_auctions()`,
-- chamada sob demanda pelo client (mesmo padrão de `generate_next_match`/`get_or_create_season`
-- — não há pg_cron configurado neste projeto).

create or replace function settle_expired_auctions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing        auctions%rowtype;
  v_bidder_budget  integer;
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
