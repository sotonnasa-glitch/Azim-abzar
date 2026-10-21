-- Keep product pricing and inventory values valid even when a signed-in editor calls PostgREST directly.
-- The live catalog was checked before this migration: no negative prices, stock quantities,
-- or invalid active product discounts were present.
BEGIN;

ALTER TABLE public.products
  ADD CONSTRAINT products_price_nonnegative
    CHECK (price IS NULL OR price >= 0),
  ADD CONSTRAINT products_original_price_nonnegative
    CHECK (original_price IS NULL OR original_price >= 0),
  ADD CONSTRAINT products_stock_quantity_nonnegative
    CHECK (stock_quantity >= 0),
  ADD CONSTRAINT products_discount_value_nonnegative
    CHECK (discount_value IS NULL OR discount_value >= 0),
  ADD CONSTRAINT products_active_discount_valid
    CHECK (
      NOT discount_is_active
      OR (
        discount_type IN ('percentage', 'fixed')
        AND discount_value IS NOT NULL
        AND discount_value > 0
        AND (discount_type <> 'percentage' OR discount_value <= 100)
      )
    );

COMMIT;
