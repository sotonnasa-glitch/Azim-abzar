begin;
create table if not exists public.product_reviews(
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (length(btrim(comment)) between 3 and 1000),
  mobile text not null check (mobile ~ '^09[0-9]{9}$'),
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,mobile)
);
create index if not exists product_reviews_approved_idx on public.product_reviews(product_id,approved,created_at desc);
alter table public.product_reviews enable row level security;
drop policy if exists "Public read approved product reviews" on public.product_reviews;
create policy "Public read approved product reviews"
on public.product_reviews for select to anon,authenticated
using (approved=true);
drop policy if exists "Public submit pending product reviews" on public.product_reviews;
create policy "Public submit pending product reviews"
on public.product_reviews for insert to anon,authenticated
with check (
  approved=false
  and mobile ~ '^09[0-9]{9}$'
  and rating between 1 and 5
  and length(btrim(comment)) between 3 and 1000
  and exists(select 1 from public.products p where p.id=product_id and p.is_active=true)
);
commit;