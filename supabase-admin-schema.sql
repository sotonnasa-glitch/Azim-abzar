-- عظیم ابزار: Admin Panel database extension
-- Run this after supabase-schema.sql. It is safe to re-run.

create schema if not exists private;

alter table public.admin_users
  add column if not exists role text not null default 'admin',
  add column if not exists is_active boolean not null default true;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  logo text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  mobile text not null,
  email text,
  subject text,
  business text,
  details text not null,
  product_id uuid references public.products(id) on delete set null,
  status text not null default 'new' check (status in ('new','in_progress','quoted','answered','closed','spam')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  source text not null default 'contact_form',
  admin_notes text,
  handled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inquiries_status_idx on public.inquiries(status,created_at desc);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  mobile text not null unique,
  email text,
  company text,
  address text,
  city text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','confirmed','processing','shipped','delivered','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','refunded')),
  shipping_status text not null default 'pending' check (shipping_status in ('pending','packed','shipped','delivered')),
  subtotal bigint not null default 0,
  discount bigint not null default 0,
  shipping_cost bigint not null default 0,
  total bigint not null default 0,
  tracking_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  sku text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price bigint not null default 0,
  variant jsonb,
  line_total bigint not null default 0
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  storage_path text not null,
  public_url text,
  mime_type text,
  size_bytes bigint,
  folder text not null default 'general',
  alt_text text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique,
  title text,
  payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists categories_touch_updated_at on public.categories;
create trigger categories_touch_updated_at before update on public.categories for each row execute function private.touch_updated_at();
drop trigger if exists brands_touch_updated_at on public.brands;
create trigger brands_touch_updated_at before update on public.brands for each row execute function private.touch_updated_at();
drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at before update on public.products for each row execute function private.touch_updated_at();
drop trigger if exists inquiries_touch_updated_at on public.inquiries;
create trigger inquiries_touch_updated_at before update on public.inquiries for each row execute function private.touch_updated_at();
drop trigger if exists customers_touch_updated_at on public.customers;
create trigger customers_touch_updated_at before update on public.customers for each row execute function private.touch_updated_at();
drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at before update on public.orders for each row execute function private.touch_updated_at();
drop trigger if exists site_content_touch_updated_at on public.site_content;
create trigger site_content_touch_updated_at before update on public.site_content for each row execute function private.touch_updated_at();

create or replace function private.is_azim_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.admin_users where user_id=auth.uid() and is_active=true); $$;
revoke all on function private.is_azim_admin() from public;
grant execute on function private.is_azim_admin() to authenticated;

-- Remove the old exposed helper from the original schema.
drop function if exists public.is_azim_admin();

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.inquiries enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.media_assets enable row level security;
alter table public.site_content enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Admins can read own admin row" on public.admin_users;
create policy "Admins can read own admin row" on public.admin_users for select to authenticated using (user_id=auth.uid());
drop policy if exists "Admins manage admin users" on public.admin_users;
create policy "Admins manage admin users" on public.admin_users for all to authenticated using (private.is_azim_admin()) with check (private.is_azim_admin());

drop policy if exists "Public can read products" on public.products;
drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products" on public.products for select to anon using (coalesce(is_active,true) or private.is_azim_admin());
drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products" on public.products for insert to authenticated with check (private.is_azim_admin());
drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products" on public.products for update to authenticated using (private.is_azim_admin()) with check (private.is_azim_admin());
drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products" on public.products for delete to authenticated using (private.is_azim_admin());

drop policy if exists "Public can read active categories" on public.categories;
create policy "Public can read active categories" on public.categories for select to anon using (is_active=true or private.is_azim_admin());
drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories for all to authenticated using (private.is_azim_admin()) with check (private.is_azim_admin());

drop policy if exists "Public can read active brands" on public.brands;
create policy "Public can read active brands" on public.brands for select to anon using (is_active=true or private.is_azim_admin());
drop policy if exists "Admins manage brands" on public.brands;
create policy "Admins manage brands" on public.brands for all to authenticated using (private.is_azim_admin()) with check (private.is_azim_admin());

drop policy if exists "Public can create inquiries" on public.inquiries;
create policy "Public can create inquiries" on public.inquiries for insert to anon with check (true);
drop policy if exists "Admins manage inquiries" on public.inquiries;
create policy "Admins manage inquiries" on public.inquiries for all to authenticated using (private.is_azim_admin()) with check (private.is_azim_admin());

drop policy if exists "Admins manage customers" on public.customers;
create policy "Admins manage customers" on public.customers for all to authenticated using (private.is_azim_admin()) with check (private.is_azim_admin());
drop policy if exists "Admins manage orders" on public.orders;
create policy "Admins manage orders" on public.orders for all to authenticated using (private.is_azim_admin()) with check (private.is_azim_admin());
drop policy if exists "Admins manage order items" on public.order_items;
create policy "Admins manage order items" on public.order_items for all to authenticated using (private.is_azim_admin()) with check (private.is_azim_admin());
drop policy if exists "Admins manage media assets" on public.media_assets;
create policy "Admins manage media assets" on public.media_assets for all to authenticated using (private.is_azim_admin()) with check (private.is_azim_admin());

drop policy if exists "Public can read active site content" on public.site_content;
create policy "Public can read active site content" on public.site_content for select to anon using (is_active=true or private.is_azim_admin());
drop policy if exists "Admins manage site content" on public.site_content;
create policy "Admins manage site content" on public.site_content for all to authenticated using (private.is_azim_admin()) with check (private.is_azim_admin());

drop policy if exists "Admins read audit logs" on public.audit_logs;
create policy "Admins read audit logs" on public.audit_logs for select to authenticated using (private.is_azim_admin());
drop policy if exists "Admins insert audit logs" on public.audit_logs;
create policy "Admins insert audit logs" on public.audit_logs for insert to authenticated with check (private.is_azim_admin());

insert into storage.buckets(id,name,public) values ('admin-media','admin-media',true) on conflict(id) do update set public=true;

create index if not exists inquiries_handled_by_idx on public.inquiries(handled_by);
create index if not exists inquiries_product_id_idx on public.inquiries(product_id);
create index if not exists media_assets_uploaded_by_idx on public.media_assets(uploaded_by);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists site_content_updated_by_idx on public.site_content(updated_by);
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);

-- Legacy project helper: keep callable only by server roles, never by the browser.
revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon;
revoke all on function public.rls_auto_enable() from authenticated;


drop policy if exists "Public can read product images" on storage.objects;
create policy "Public can read product images" on storage.objects for select using (bucket_id='product-images');
drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images" on storage.objects for insert to authenticated with check (bucket_id='product-images' and private.is_azim_admin());
drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images" on storage.objects for update to authenticated using (bucket_id='product-images' and private.is_azim_admin()) with check (bucket_id='product-images' and private.is_azim_admin());
drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images" on storage.objects for delete to authenticated using (bucket_id='product-images' and private.is_azim_admin());

drop policy if exists "Public can read admin media" on storage.objects;
create policy "Public can read admin media" on storage.objects for select using (bucket_id='admin-media');
drop policy if exists "Admins can upload admin media" on storage.objects;
create policy "Admins can upload admin media" on storage.objects for insert to authenticated with check (bucket_id='admin-media' and private.is_azim_admin());
drop policy if exists "Admins can update admin media" on storage.objects;
create policy "Admins can update admin media" on storage.objects for update to authenticated using (bucket_id='admin-media' and private.is_azim_admin()) with check (bucket_id='admin-media' and private.is_azim_admin());
drop policy if exists "Admins can delete admin media" on storage.objects;
create policy "Admins can delete admin media" on storage.objects for delete to authenticated using (bucket_id='admin-media' and private.is_azim_admin());
