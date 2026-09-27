-- Keep authenticated customers able to read the active public catalog,
-- and keep public review submissions limited to active products.
alter policy "Public can read active products"
on public.products
to anon, authenticated;

drop policy if exists "Public submit pending product reviews" on public.product_reviews;

create policy "Public submit pending product reviews"
on public.product_reviews
for insert
to anon, authenticated
with check (
  approved = false
  and mobile ~ '^09[0-9]{9}$'
  and rating between 1 and 5
  and length(btrim(comment)) between 3 and 1000
  and exists (
    select 1
    from public.products p
    where p.id = product_reviews.product_id
      and p.is_active = true
  )
);
