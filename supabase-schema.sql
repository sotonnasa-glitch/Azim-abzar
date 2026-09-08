-- عظیم ابزار: Supabase schema
-- Run this once in Supabase SQL Editor.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null default 'بدون برند',
  cat text not null,
  code text,
  badge text,
  desc text not null,
  img text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_cat_idx on public.products(cat);
create index if not exists products_name_idx on public.products using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(brand,'')));

alter table public.products enable row level security;
alter table public.admin_users enable row level security;

create or replace function public.is_azim_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_azim_admin() from public;
grant execute on function public.is_azim_admin() to anon, authenticated;

 drop policy if exists "Public can read products" on public.products;
create policy "Public can read products" on public.products
for select using (true);

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products" on public.products
for insert to authenticated with check (public.is_azim_admin());

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products" on public.products
for update to authenticated using (public.is_azim_admin()) with check (public.is_azim_admin());

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products" on public.products
for delete to authenticated using (public.is_azim_admin());

drop policy if exists "Admins can read own admin row" on public.admin_users;
create policy "Admins can read own admin row" on public.admin_users
for select to authenticated using (user_id = auth.uid());

-- Public product-image bucket. Admin-only writes; public reads.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read product images" on storage.objects;
create policy "Public can read product images" on storage.objects
for select using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images" on storage.objects
for insert to authenticated with check (bucket_id = 'product-images' and public.is_azim_admin());

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images" on storage.objects
for update to authenticated using (bucket_id = 'product-images' and public.is_azim_admin()) with check (bucket_id = 'product-images' and public.is_azim_admin());

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images" on storage.objects
for delete to authenticated using (bucket_id = 'product-images' and public.is_azim_admin());

-- After creating the first admin account in Supabase Auth,
-- run: insert into public.admin_users(user_id) values ('YOUR-AUTH-USER-UUID');
