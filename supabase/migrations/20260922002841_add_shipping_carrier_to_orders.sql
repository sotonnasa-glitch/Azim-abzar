alter table public.orders
add column if not exists shipping_carrier text,
add column if not exists tracking_url text;