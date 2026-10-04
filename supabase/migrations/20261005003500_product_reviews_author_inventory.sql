-- Product reviews: public author name + optional legacy mobile
alter table public.product_reviews
  add column if not exists author_name text;

update public.product_reviews
set author_name = coalesce(nullif(btrim(author_name), ''), 'مشتری')
where author_name is null or btrim(author_name) = '';

alter table public.product_reviews
  alter column author_name set default 'مشتری',
  alter column author_name drop not null,
  alter column mobile drop not null;

alter table public.product_reviews
  drop constraint if exists product_reviews_mobile_check;

alter table public.product_reviews
  drop constraint if exists product_reviews_optional_mobile_check;

alter table public.product_reviews
  drop constraint if exists product_reviews_author_name_check;

alter table public.product_reviews
  add constraint product_reviews_author_name_check
  check (author_name is null or (length(btrim(author_name)) between 2 and 80));

alter table public.product_reviews
  add constraint product_reviews_mobile_optional_check
  check (mobile is null or mobile ~ '^09[0-9]{9}$');

drop policy if exists "Public submit pending product reviews" on public.product_reviews;

create policy "Public submit pending product reviews"
on public.product_reviews
for insert
to anon, authenticated
with check (
  approved = false
  and author_name is not null
  and length(btrim(author_name)) between 2 and 80
  and rating between 1 and 5
  and length(btrim(comment)) between 3 and 1000
  and exists (
    select 1
    from public.products p
    where p.id = product_reviews.product_id
      and p.is_active = true
  )
);

grant select, insert on public.product_reviews to anon;
grant select, insert, update, delete on public.product_reviews to authenticated;

-- New products are created by the admin UI with stock=1 and stock tracking enabled.
-- Existing products keep their current inventory state until an admin changes it.
