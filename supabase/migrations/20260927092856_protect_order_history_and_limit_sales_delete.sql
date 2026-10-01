drop policy if exists "Sales manage orders" on public.orders;
drop policy if exists "Sales manage order items" on public.order_items;

create policy "Owner and admin manage orders"
on public.orders for all to authenticated
using (private.has_azim_role(ARRAY['owner','admin']))
with check (private.has_azim_role(ARRAY['owner','admin']));

create policy "Sales read orders"
on public.orders for select to authenticated
using (private.has_azim_role(ARRAY['sales']));

create policy "Sales update orders"
on public.orders for update to authenticated
using (private.has_azim_role(ARRAY['sales']))
with check (private.has_azim_role(ARRAY['sales']));

create policy "Owner and admin manage order items"
on public.order_items for all to authenticated
using (private.has_azim_role(ARRAY['owner','admin']))
with check (private.has_azim_role(ARRAY['owner','admin']));

create policy "Sales read order items"
on public.order_items for select to authenticated
using (private.has_azim_role(ARRAY['sales']));

create policy "Sales update order items"
on public.order_items for update to authenticated
using (private.has_azim_role(ARRAY['sales']))
with check (private.has_azim_role(ARRAY['sales']));

alter table public.order_items drop constraint if exists order_items_order_id_fkey;
alter table public.order_items add constraint order_items_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete restrict;

alter table public.order_return_requests drop constraint if exists order_return_requests_order_id_fkey;
alter table public.order_return_requests add constraint order_return_requests_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete restrict;

alter table public.order_return_requests drop constraint if exists order_return_requests_order_item_id_fkey;
alter table public.order_return_requests add constraint order_return_requests_order_item_id_fkey
  foreign key (order_item_id) references public.order_items(id) on delete restrict;

create unique index if not exists customers_mobile_uq
  on public.customers(mobile)
  where mobile is not null and mobile <> '';
