-- Keep public review submission limited to pending, valid reviews.
-- Product existence is enforced by the foreign key; public product visibility
-- is enforced separately by products RLS and the catalog UI.
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
);
