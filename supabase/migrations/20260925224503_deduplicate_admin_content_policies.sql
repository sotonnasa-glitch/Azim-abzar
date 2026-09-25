begin;

drop policy if exists "Owner admin delete admin users" on public.admin_users;
drop policy if exists "Owner admin insert admin users" on public.admin_users;
drop policy if exists "Owner admin update admin users" on public.admin_users;
drop policy if exists "Owner manages all admin users" on public.admin_users;
drop policy if exists "Admins manage staff only" on public.admin_users;
drop policy if exists "Admins update staff only" on public.admin_users;

create policy "Admin users insert"
on public.admin_users
for insert to authenticated
with check (
  (select private.has_azim_role(array['owner'::text]))
  or (
    (select private.has_azim_role(array['admin'::text]))
    and role in ('editor','sales')
  )
);

create policy "Admin users update"
on public.admin_users
for update to authenticated
using (
  (select private.has_azim_role(array['owner'::text]))
  or (
    (select private.has_azim_role(array['admin'::text]))
    and role in ('editor','sales')
  )
)
with check (
  (select private.has_azim_role(array['owner'::text]))
  or (
    (select private.has_azim_role(array['admin'::text]))
    and role in ('editor','sales')
  )
);

create policy "Owner deletes admin users"
on public.admin_users
for delete to authenticated
using ((select private.has_azim_role(array['owner'::text])));

drop policy if exists "Owner admin manage site content" on public.site_content;
drop policy if exists "Editors manage non-sensitive site content" on public.site_content;

create policy "Staff manage allowed site content"
on public.site_content
for all to authenticated
using (
  (select private.has_azim_role(array['owner'::text,'admin'::text]))
  or (
    (select private.has_azim_role(array['editor'::text]))
    and section_key not in ('checkout_payment','ai_settings')
  )
)
with check (
  (select private.has_azim_role(array['owner'::text,'admin'::text]))
  or (
    (select private.has_azim_role(array['editor'::text]))
    and section_key not in ('checkout_payment','ai_settings')
  )
);

drop policy if exists "Discount redemptions select" on public.discount_redemptions;
drop policy if exists "Staff can read discount redemptions" on public.discount_redemptions;
create policy "Staff can read discount redemptions"
on public.discount_redemptions
for select to authenticated
using ((select private.has_azim_role(array['owner'::text,'admin'::text,'sales'::text])));

create index if not exists discounts_updated_by_idx
  on public.discounts(updated_by);

commit;