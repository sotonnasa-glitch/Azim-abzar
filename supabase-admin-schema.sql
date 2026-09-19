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
as $ select exists(select 1 from public.admin_users where user_id=auth.uid() and is_active=true); $;
revoke all on function private.is_azim_admin() from public;
grant execute on function private.is_azim_admin() to authenticated;

create or replace function private.has_azim_role(allowed_roles text[])
returns boolean language sql stable security definer set search_path=public
as $ select exists(
  select 1 from public.admin_users
  where user_id=auth.uid() and is_active=true and role = any(allowed_roles)
); $;
revoke all on function private.has_azim_role(text[]) from public;
grant execute on function private.has_azim_role(text[]) to authenticated;

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
drop policy if exists "Owner admin manage admin users" on public.admin_users;
create policy "Owner admin manage admin users" on public.admin_users for all to authenticated
using (private.has_azim_role(array['owner','admin']))
with check (private.has_azim_role(array['owner','admin']));

drop policy if exists "Public can read products" on public.products;
drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products" on public.products for select to anon
using (coalesce(is_active,true));
drop policy if exists "Admins can read products" on public.products;
create policy "Admins can read products" on public.products for select to authenticated
using (private.is_azim_admin());
drop policy if exists "Admins can insert products" on public.products;
drop policy if exists "Editors can insert products" on public.products;
create policy "Editors can insert products" on public.products for insert to authenticated
with check (private.has_azim_role(array['owner','admin','editor']));
drop policy if exists "Admins can update products" on public.products;
drop policy if exists "Editors can update products" on public.products;
create policy "Editors can update products" on public.products for update to authenticated
using (private.has_azim_role(array['owner','admin','editor']))
with check (private.has_azim_role(array['owner','admin','editor']));
drop policy if exists "Admins can delete products" on public.products;
drop policy if exists "Editors can delete products" on public.products;
create policy "Editors can delete products" on public.products for delete to authenticated
using (private.has_azim_role(array['owner','admin','editor']));

drop policy if exists "Public can read active categories" on public.categories;
create policy "Public can read active categories" on public.categories for select to anon
using (is_active=true);
drop policy if exists "Admins manage categories" on public.categories;
drop policy if exists "Editors manage categories" on public.categories;
create policy "Editors manage categories" on public.categories for all to authenticated
using (private.has_azim_role(array['owner','admin','editor']))
with check (private.has_azim_role(array['owner','admin','editor']));

drop policy if exists "Public can read active brands" on public.brands;
create policy "Public can read active brands" on public.brands for select to anon
using (is_active=true);
drop policy if exists "Admins manage brands" on public.brands;
drop policy if exists "Editors manage brands" on public.brands;
create policy "Editors manage brands" on public.brands for all to authenticated
using (private.has_azim_role(array['owner','admin','editor']))
with check (private.has_azim_role(array['owner','admin','editor']));

drop policy if exists "Public can create inquiries" on public.inquiries;
create policy "Public can create inquiries" on public.inquiries for insert to anon with check (true);
drop policy if exists "Admins manage inquiries" on public.inquiries;
drop policy if exists "Sales manage inquiries" on public.inquiries;
create policy "Sales manage inquiries" on public.inquiries for all to authenticated
using (private.has_azim_role(array['owner','admin','sales']))
with check (private.has_azim_role(array['owner','admin','sales']));

drop policy if exists "Admins manage customers" on public.customers;
drop policy if exists "Sales manage customers" on public.customers;
create policy "Sales manage customers" on public.customers for all to authenticated
using (private.has_azim_role(array['owner','admin','sales']))
with check (private.has_azim_role(array['owner','admin','sales']));

drop policy if exists "Admins manage orders" on public.orders;
drop policy if exists "Sales manage orders" on public.orders;
create policy "Sales manage orders" on public.orders for all to authenticated
using (private.has_azim_role(array['owner','admin','sales']))
with check (private.has_azim_role(array['owner','admin','sales']));

drop policy if exists "Admins manage order items" on public.order_items;
drop policy if exists "Sales manage order items" on public.order_items;
create policy "Sales manage order items" on public.order_items for all to authenticated
using (private.has_azim_role(array['owner','admin','sales']))
with check (private.has_azim_role(array['owner','admin','sales']));

drop policy if exists "Admins manage media assets" on public.media_assets;
drop policy if exists "Editors manage media assets" on public.media_assets;
create policy "Editors manage media assets" on public.media_assets for all to authenticated
using (private.has_azim_role(array['owner','admin','editor']))
with check (private.has_azim_role(array['owner','admin','editor']));

drop policy if exists "Public can read active site content" on public.site_content;
create policy "Public can read active site content" on public.site_content for select to anon
using (is_active=true);
drop policy if exists "Admins manage site content" on public.site_content;
drop policy if exists "Editors manage site content" on public.site_content;
create policy "Editors manage site content" on public.site_content for all to authenticated
using (private.has_azim_role(array['owner','admin','editor']))
with check (private.has_azim_role(array['owner','admin','editor']));

drop policy if exists "Admins read audit logs" on public.audit_logs;
drop policy if exists "Admins insert audit logs" on public.audit_logs;
drop policy if exists "Owner admin read audit logs" on public.audit_logs;
drop policy if exists "Active admins insert audit logs" on public.audit_logs;
create policy "Owner admin read audit logs" on public.audit_logs for select to authenticated
using (private.has_azim_role(array['owner','admin']));
create policy "Active admins insert audit logs" on public.audit_logs for insert to authenticated
with check (private.is_azim_admin());

insert into storage.buckets(id,name,public) values ('admin-media','admin-media',true) on conflict(id) do update set public=true;

create index if not exists inquiries_handled_by_idx on public.inquiries(handled_by);
create index if not exists inquiries_product_id_idx on public.inquiries(product_id);
create index if not exists media_assets_uploaded_by_idx on public.media_assets(uploaded_by);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists site_content_updated_by_idx on public.site_content(updated_by);
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);

-- Initial catalog categories and a neutral default brand.
insert into public.categories(name,slug,sort_order,is_active) values
  ('آچار و بکس','cat-1',1,true),
  ('ابزار دستی','cat-2',2,true),
  ('اندازه‌گیری','cat-3',3,true),
  ('برقی / بادی','cat-4',4,true),
  ('تعمیرگاهی','cat-5',5,true)
on conflict (slug) do update set name=excluded.name,sort_order=excluded.sort_order,is_active=true;

insert into public.brands(name,slug,description,sort_order,is_active)
values ('بدون برند','default','محصولاتی که برند آن‌ها در داده فعلی کاتالوگ ثبت نشده است.',0,true)
on conflict (name) do update set is_active=true;

insert into public.site_content(section_key,title,payload,is_active) values
('home_meta','متای صفحه اصلی',jsonb_build_object(
  'title','عظیم ابزار | مرجع تخصصی ابزارهای مکانیکی، کارگاهی و صنعتی',
  'description','خرید تخصصی ابزارهای مکانیکی، گاراژی و کارگاهی با آلیاژ سخت‌کاری‌شده، تضمین اصالت، قیمت دست‌اول بازار و کاتالوگ کامل ۹۰۸ محصول به همراه استعلام آنی و ارسال به سراسر کشور.'
),true),
('home_hero','هیرو صفحه اصلی',jsonb_build_object(
  'eyebrow','تأمین مستقیم و بی‌واسطه ابزار صنعتی',
  'title','تجهیزات صنعتی و ابزار تخصصی مکانیکی؛',
  'highlight','قدرت، دقت و دوام برای حرفه‌ای‌ها',
  'description','بزرگ‌ترین مرجع تأمین بیش از ۹۰۸ قلم ابزار گاراژی، تعمیرگاهی و صنعتی با آلیاژ سخت‌کاری‌شده کروم وانادیوم (Cr-V). تضمین اصالت فیزیکی کالا، قیمت دست‌اول بازار، سایزبندی کامل و ارسال فوری به سراسر کشور.',
  'trust_badges',jsonb_build_array('فولاد کروم وانادیوم سخت‌کاری‌شده','قیمت دست اول و رقابتی بازار','مشاوره فنی تخصصی رایگان','ارسال فوری به سراسر ایران'),
  'primary_cta','مشاهده کاتالوگ و قیمت‌های بروز',
  'secondary_ai_cta','دستیار هوشمند انتخاب ابزار (AI)',
  'contact_cta','ارتباط مستقیم با فروشگاه'
),true),
('home_choice','مسیرهای خرید',jsonb_build_object(
  'eyebrow','مسیر آسان و مطمئن خرید',
  'title','چگونه بهترین ابزار را سریع و مطمئن انتخاب کنیم؟',
  'lead','چه نام و کد فنی ابزار را بدانید و چه فقط شرح کار مکانیکی را داشته باشید، عظیم ابزار مسیر را برای شما هموار کرده است:'
),true),
('home_why','مزیت‌های فروشگاه',jsonb_build_object(
  'eyebrow','مزیت رقابتی عظیم ابزار',
  'title','چرا استادکاران و تعمیرگاه‌ها به عظیم ابزار اعتماد می‌کنند؟',
  'lead','خرید ابزار یعنی سرمایه‌گذاری برای دقت و درآمد کار شما؛ تعهد ما ارائه بالاترین کیفیت با قیمت بی‌واسطه است.'
),true),
('ai_settings','کنترل دستیار هوشمند',jsonb_build_object(
  'enabled',true,
  'provider','gemini',
  'model','gemini-3.6-flash',
  'fallback_model','gpt-4o-mini',
  'greeting','سلام 👋 من دستیار هوشمند عظیم ابزارم. بگو چه کاری انجام می‌دی یا چه ابزاری لازم داری تا راهنمایی‌ات کنم.',
  'system_instruction','تو دستیار هوشمند فروشگاه عظیم ابزار هستی. به زبان فارسی روان، کوتاه و کاربردی پاسخ بده. به مشتریان برای انتخاب و آشنایی با انواع ابزارهای مکانیکی، تعمیرگاهی، کارگاهی و ابزار دستی کمک کن. اگر اطلاعات درخواست شده کافی نیست، مؤدبانه سوال بپرس. قیمت یا موجودی قطعی را بدون اطلاعات واقعی فروشگاه حدس نزن.',
  'quick_prompts',jsonb_build_array('برای تعمیرگاه خودرو چه ابزارهایی پیشنهاد می‌کنی؟','برای خرید آچار چه نکاتی مهم است؟','یک ست ابزار اقتصادی پیشنهاد بده')
),true),
('contact_page','صفحه ارتباط و سفارش',jsonb_build_object(
  'title','ارتباط و سفارش مستقیم | عظیم ابزار',
  'description','ارتباط مستقیم با عظیم ابزار؛ مشاوره فنی ابزارهای مکانیکی و گاراژی، استعلام قیمت و صدور پیش‌فاکتور',
  'email','info@azimabzar.ir'
),true)
on conflict (section_key) do update set title=excluded.title,payload=excluded.payload,is_active=true;

-- Legacy project helper: keep callable only by server roles, never by the browser.
revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon;
revoke all on function public.rls_auto_enable() from authenticated;


insert into storage.buckets(id,name,public) values ('product-images','product-images',true) on conflict(id) do update set public=true;
insert into storage.buckets(id,name,public) values ('admin-media','admin-media',true) on conflict(id) do update set public=true;

drop policy if exists "Public can read product images" on storage.objects;
create policy "Public can read product images" on storage.objects for select using (bucket_id='product-images');
drop policy if exists "Admins can upload product images" on storage.objects;
drop policy if exists "Editors can upload product images" on storage.objects;
create policy "Editors can upload product images" on storage.objects for insert to authenticated
with check (bucket_id='product-images' and private.has_azim_role(array['owner','admin','editor']));
drop policy if exists "Admins can update product images" on storage.objects;
drop policy if exists "Editors can update product images" on storage.objects;
create policy "Editors can update product images" on storage.objects for update to authenticated
using (bucket_id='product-images' and private.has_azim_role(array['owner','admin','editor']))
with check (bucket_id='product-images' and private.has_azim_role(array['owner','admin','editor']));
drop policy if exists "Admins can delete product images" on storage.objects;
drop policy if exists "Editors can delete product images" on storage.objects;
create policy "Editors can delete product images" on storage.objects for delete to authenticated
using (bucket_id='product-images' and private.has_azim_role(array['owner','admin','editor']));

drop policy if exists "Public can read admin media" on storage.objects;
create policy "Public can read admin media" on storage.objects for select using (bucket_id='admin-media');
drop policy if exists "Admins can upload admin media" on storage.objects;
drop policy if exists "Editors can upload admin media" on storage.objects;
create policy "Editors can upload admin media" on storage.objects for insert to authenticated
with check (bucket_id='admin-media' and private.has_azim_role(array['owner','admin','editor']));
drop policy if exists "Admins can update admin media" on storage.objects;
drop policy if exists "Editors can update admin media" on storage.objects;
create policy "Editors can update admin media" on storage.objects for update to authenticated
using (bucket_id='admin-media' and private.has_azim_role(array['owner','admin','editor']))
with check (bucket_id='admin-media' and private.has_azim_role(array['owner','admin','editor']));
drop policy if exists "Admins can delete admin media" on storage.objects;
drop policy if exists "Editors can delete admin media" on storage.objects;
create policy "Editors can delete admin media" on storage.objects for delete to authenticated
using (bucket_id='admin-media' and private.has_azim_role(array['owner','admin','editor']));


-- Admin handoff password rotation
alter table public.admin_users
  add column if not exists password_change_required boolean not null default false;

comment on column public.admin_users.password_change_required is 'When true, the admin UI requires the signed-in user to change their password before continuing.';

create or replace function public.azim_self_clear_password_change_required()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.admin_users
     set password_change_required = false
   where user_id = auth.uid()
     and is_active = true;
  return found;
end;
$$;

revoke all on function public.azim_self_clear_password_change_required() from public;
grant execute on function public.azim_self_clear_password_change_required() to authenticated;
