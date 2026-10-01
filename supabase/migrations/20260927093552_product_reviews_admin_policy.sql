drop policy if exists "Admin manage product reviews" on public.product_reviews;
create policy "Admin manage product reviews"
on public.product_reviews for all to authenticated
using (private.has_azim_role(ARRAY['owner','admin','editor']))
with check (private.has_azim_role(ARRAY['owner','admin','editor']));
