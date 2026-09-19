-- Direct product discount support
-- Live schema: public.products

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value bigint,
  ADD COLUMN IF NOT EXISTS discount_is_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS discount_ends_at timestamptz;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_discount_type_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_discount_type_check
  CHECK (discount_type IS NULL OR discount_type IN ('percentage','fixed'));

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_discount_value_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_discount_value_check
  CHECK (discount_value IS NULL OR discount_value > 0);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_discount_percentage_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_discount_percentage_check
  CHECK (discount_type <> 'percentage' OR discount_value BETWEEN 1 AND 100);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_discount_dates_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_discount_dates_check
  CHECK (discount_ends_at IS NULL OR discount_starts_at IS NULL OR discount_ends_at > discount_starts_at);

CREATE INDEX IF NOT EXISTS products_active_direct_discount_idx
  ON public.products (discount_starts_at, discount_ends_at)
  WHERE discount_is_active = true;
