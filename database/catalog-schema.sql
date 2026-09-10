-- عظیم ابزار: catalog database migration
-- Run in Supabase SQL Editor before importing the 2119-product seed.
begin;
alter table public.products add column if not exists original_price bigint;
alter table public.products add column if not exists price bigint;
alter table public.products add column if not exists page integer;
alter table public.products add column if not exists category_name text;
alter table public.products add column if not exists is_active boolean not null default true;
-- The frontend uses `description`; keep the existing `desc` column compatible.
alter table public.products add column if not exists description text not null default '';
create unique index if not exists products_code_uidx on public.products(code) where code is not null;
create index if not exists products_price_idx on public.products(price);
create index if not exists products_page_idx on public.products(page);
commit;
