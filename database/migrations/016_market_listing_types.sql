-- Migration 016: Add listing_type and sale_price to auctions
-- Supports both auction (bidding) and direct sale (fixed price)

ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS listing_type text NOT NULL DEFAULT 'auction'
    CHECK (listing_type IN ('auction', 'direct_sale')),
  ADD COLUMN IF NOT EXISTS sale_price integer DEFAULT NULL;

-- Atomic buy function for direct sales (runs as SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION buy_player_direct(
  p_listing_id    uuid,
  p_buyer_team_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing     auctions%ROWTYPE;
BEGIN
  -- Lock the row so concurrent buys fail
  SELECT * INTO v_listing
    FROM auctions
   WHERE id = p_listing_id
     AND status = 'active'
     AND listing_type = 'direct_sale'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_available';
  END IF;

  IF v_listing.seller_team_id = p_buyer_team_id THEN
    RAISE EXCEPTION 'cannot_buy_own_player';
  END IF;

  -- Mark sold
  UPDATE auctions
     SET status = 'ended', current_bidder_team_id = p_buyer_team_id
   WHERE id = p_listing_id;

  -- Transfer player to buyer
  UPDATE players
     SET team_id = p_buyer_team_id
   WHERE id = v_listing.player_id;

  -- Deduct from buyer
  UPDATE teams
     SET budget = budget - v_listing.sale_price
   WHERE id = p_buyer_team_id;

  -- Credit seller
  UPDATE teams
     SET budget = budget + v_listing.sale_price
   WHERE id = v_listing.seller_team_id;
END;
$$;
