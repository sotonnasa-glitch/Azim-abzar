alter table public.products
  add column if not exists stock_quantity integer not null default 0,
  add column if not exists stock_tracking_enabled boolean not null default false;
alter table public.orders
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;
create index if not exists products_stock_idx on public.products(stock_tracking_enabled,stock_quantity);
