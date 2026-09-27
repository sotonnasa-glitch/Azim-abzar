-- Restore Data API access for public product reviews.
-- RLS policies remain the authorization boundary.
grant select, insert on public.product_reviews to anon;
grant select, insert, update, delete on public.product_reviews to authenticated;
