begin;

alter table public.products
  add column if not exists base_price bigint
  generated always as (price) stored;

comment on column public.products.base_price is
  'Backward-compatible alias for the catalog base price; derived from products.price.';

commit;