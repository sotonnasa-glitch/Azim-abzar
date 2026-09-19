-- عظیم ابزار: Discounts & Promotions
-- Idempotent schema for the production discount engine.
-- Applied to Supabase project lzkrwtnylkordkwkdyzp on 2026-09-19.

create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  discount_type text not null default 'percentage' check (discount_type in ('percentage','fixed')),
  value bigint not null check (value > 0),
  max_discount bigint,
  min_order_amount bigint not null default 0 check (min_order_amount >= 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  usage_limit integer,
  per_customer_limit integer not null default 1 check (per_customer_limit >= 1),
  first_order_only boolean not null default false,
  auto_apply boolean not null default false,
  applies_to text not null default 'all' check (applies_to in ('all','products','categories','brands','customers')),
  priority integer not null default 0,
  is_active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discounts_dates_chk check (ends_at is null or ends_at > starts_at),
  constraint discounts_percentage_chk check (discount_type <> 'percentage' or value between 1 and 100),
  constraint discounts_max_chk check (max_discount is null or max_discount >= 0),
  constraint discounts_usage_chk check (usage_limit is null or usage_limit >= 1)
);

create table if not exists public.discount_products (
  discount_id uuid not null references public.discounts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (discount_id, product_id)
);

create table if not exists public.discount_categories (
  discount_id uuid not null references public.discounts(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (discount_id, category_id)
);

create table if not exists public.discount_brands (
  discount_id uuid not null references public.discounts(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (discount_id, brand_id)
);

create table if not exists public.discount_customers (
  discount_id uuid not null references public.discounts(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (discount_id, customer_id)
);

create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discounts(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  code_used text,
  discount_amount bigint not null default 0 check (discount_amount >= 0),
  redeemed_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (discount_id, order_id)
);

alter table public.orders
  add column if not exists discount_id uuid references public.discounts(id) on delete set null,
  add column if not exists discount_code text;

create index if not exists discounts_code_idx on public.discounts(lower(code)) where code is not null;
create index if not exists discounts_active_dates_idx on public.discounts(is_active, starts_at, ends_at);
create index if not exists discounts_priority_idx on public.discounts(priority desc, starts_at desc);
create index if not exists discount_products_product_idx on public.discount_products(product_id);
create index if not exists discount_categories_category_idx on public.discount_categories(category_id);
create index if not exists discount_brands_brand_idx on public.discount_brands(brand_id);
create index if not exists discount_customers_customer_idx on public.discount_customers(customer_id);
create index if not exists discount_redemptions_discount_idx on public.discount_redemptions(discount_id, redeemed_at desc);
create index if not exists discount_redemptions_customer_idx on public.discount_redemptions(customer_id, redeemed_at desc);
create index if not exists orders_discount_idx on public.orders(discount_id);

alter table public.discounts enable row level security;

drop policy if exists "Admins manage discounts" on public.discounts;
drop policy if exists "Sales can read discounts" on public.discounts;
create policy "Discounts select" on public.discounts for select to authenticated
using (private.has_azim_role(array['owner','admin','sales']));
create policy "Discounts insert" on public.discounts for insert to authenticated
with check (private.has_azim_role(array['owner','admin']));
create policy "Discounts update" on public.discounts for update to authenticated
using (private.has_azim_role(array['owner','admin'])) with check (private.has_azim_role(array['owner','admin']));
create policy "Discounts delete" on public.discounts for delete to authenticated
using (private.has_azim_role(array['owner','admin']));

drop policy if exists "Admins manage discount products" on public.discount_products;
drop policy if exists "Sales can read discount products" on public.discount_products;
create policy "Discount products select" on public.discount_products for select to authenticated
using (private.has_azim_role(array['owner','admin','sales']));
create policy "Discount products insert" on public.discount_products for insert to authenticated
with check (private.has_azim_role(array['owner','admin']));
create policy "Discount products update" on public.discount_products for update to authenticated
using (private.has_azim_role(array['owner','admin'])) with check (private.has_azim_role(array['owner','admin']));
create policy "Discount products delete" on public.discount_products for delete to authenticated
using (private.has_azim_role(array['owner','admin']));

drop policy if exists "Admins manage discount categories" on public.discount_categories;
drop policy if exists "Sales can read discount categories" on public.discount_categories;
create policy "Discount categories select" on public.discount_categories for select to authenticated
using (private.has_azim_role(array['owner','admin','sales']));
create policy "Discount categories insert" on public.discount_categories for insert to authenticated
with check (private.has_azim_role(array['owner','admin']));
create policy "Discount categories update" on public.discount_categories for update to authenticated
using (private.has_azim_role(array['owner','admin'])) with check (private.has_azim_role(array['owner','admin']));
create policy "Discount categories delete" on public.discount_categories for delete to authenticated
using (private.has_azim_role(array['owner','admin']));

drop policy if exists "Admins manage discount brands" on public.discount_brands;
drop policy if exists "Sales can read discount brands" on public.discount_brands;
create policy "Discount brands select" on public.discount_brands for select to authenticated
using (private.has_azim_role(array['owner','admin','sales']));
create policy "Discount brands insert" on public.discount_brands for insert to authenticated
with check (private.has_azim_role(array['owner','admin']));
create policy "Discount brands update" on public.discount_brands for update to authenticated
using (private.has_azim_role(array['owner','admin'])) with check (private.has_azim_role(array['owner','admin']));
create policy "Discount brands delete" on public.discount_brands for delete to authenticated
using (private.has_azim_role(array['owner','admin']));

drop policy if exists "Admins manage discount customers" on public.discount_customers;
drop policy if exists "Sales can read discount customers" on public.discount_customers;
create policy "Discount customers select" on public.discount_customers for select to authenticated
using (private.has_azim_role(array['owner','admin','sales']));
create policy "Discount customers insert" on public.discount_customers for insert to authenticated
with check (private.has_azim_role(array['owner','admin']));
create policy "Discount customers update" on public.discount_customers for update to authenticated
using (private.has_azim_role(array['owner','admin'])) with check (private.has_azim_role(array['owner','admin']));
create policy "Discount customers delete" on public.discount_customers for delete to authenticated
using (private.has_azim_role(array['owner','admin']));

drop policy if exists "Admins manage discount redemptions" on public.discount_redemptions;
drop policy if exists "Sales can read discount redemptions" on public.discount_redemptions;
create policy "Discount redemptions select" on public.discount_redemptions for select to authenticated
using (private.has_azim_role(array['owner','admin','sales']));
create policy "Discount redemptions insert" on public.discount_redemptions for insert to authenticated
with check (private.has_azim_role(array['owner','admin']));
create policy "Discount redemptions update" on public.discount_redemptions for update to authenticated
using (private.has_azim_role(array['owner','admin'])) with check (private.has_azim_role(array['owner','admin']));
create policy "Discount redemptions delete" on public.discount_redemptions for delete to authenticated
using (private.has_azim_role(array['owner','admin']));

create index if not exists discounts_created_by_idx on public.discounts(created_by);
create index if not exists discount_redemptions_created_by_idx on public.discount_redemptions(created_by);
create index if not exists discount_redemptions_order_idx on public.discount_redemptions(order_id);
