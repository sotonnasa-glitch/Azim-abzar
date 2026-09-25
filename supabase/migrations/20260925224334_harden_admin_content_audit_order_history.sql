begin;

drop policy if exists "Admins manage admin users" on public.admin_users;
drop policy if exists "Owner admin manage admin users" on public.admin_users;
drop policy if exists "Admin users write" on public.admin_users;
drop policy if exists "Owner manages all admin users" on public.admin_users;
drop policy if exists "Admins manage staff only" on public.admin_users;

create policy "Owner manages all admin users"
on public.admin_users
for all to authenticated
using ((select private.has_azim_role(array['owner'::text])))
with check ((select private.has_azim_role(array['owner'::text])));

create policy "Admins manage staff only"
on public.admin_users
for insert to authenticated
with check (
  (select private.has_azim_role(array['admin'::text]))
  and role in ('editor','sales')
);

create policy "Admins update staff only"
on public.admin_users
for update to authenticated
using (
  (select private.has_azim_role(array['admin'::text]))
  and role in ('editor','sales')
)
with check (
  (select private.has_azim_role(array['admin'::text]))
  and role in ('editor','sales')
);

drop policy if exists "Admins manage site content" on public.site_content;
drop policy if exists "Editors manage site content" on public.site_content;
drop policy if exists "Owner admin manage site content" on public.site_content;
drop policy if exists "Editors manage non-sensitive site content" on public.site_content;

create policy "Owner admin manage site content"
on public.site_content
for all to authenticated
using ((select private.has_azim_role(array['owner'::text,'admin'::text])))
with check ((select private.has_azim_role(array['owner'::text,'admin'::text])));

create policy "Editors manage non-sensitive site content"
on public.site_content
for all to authenticated
using (
  (select private.has_azim_role(array['editor'::text]))
  and section_key not in ('checkout_payment','ai_settings')
)
with check (
  (select private.has_azim_role(array['editor'::text]))
  and section_key not in ('checkout_payment','ai_settings')
);

create or replace function private.enforce_audit_actor()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception using message = 'شناسه کاربر برای ثبت گزارش فعالیت مشخص نیست.';
  end if;
  new.actor_id := auth.uid();
  return new;
end;
$$;

revoke all on function private.enforce_audit_actor() from public, anon, authenticated;
drop trigger if exists trg_enforce_audit_actor on public.audit_logs;
create trigger trg_enforce_audit_actor
before insert on public.audit_logs
for each row execute function private.enforce_audit_actor();

alter table public.orders
  add column if not exists customer_name text,
  add column if not exists customer_mobile text,
  add column if not exists customer_email text,
  add column if not exists shipping_address text,
  add column if not exists shipping_city text;

update public.orders o
set customer_name = coalesce(o.customer_name,c.full_name),
    customer_mobile = coalesce(o.customer_mobile,c.mobile),
    customer_email = coalesce(o.customer_email,c.email),
    shipping_address = coalesce(o.shipping_address,c.address),
    shipping_city = coalesce(o.shipping_city,c.city)
from public.customers c
where o.customer_id = c.id;

alter table public.discounts
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

create or replace function private.touch_discount_editor()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke all on function private.touch_discount_editor() from public, anon, authenticated;
drop trigger if exists discounts_touch_editor on public.discounts;
create trigger discounts_touch_editor
before update on public.discounts
for each row execute function private.touch_discount_editor();

revoke insert, update, delete, truncate on table public.discount_redemptions from authenticated;
drop policy if exists "Admins manage discount redemptions" on public.discount_redemptions;
drop policy if exists "Sales manage discount redemptions" on public.discount_redemptions;
drop policy if exists "Admins can read discount redemptions" on public.discount_redemptions;
drop policy if exists "Sales can read discount redemptions" on public.discount_redemptions;

create policy "Staff can read discount redemptions"
on public.discount_redemptions
for select to authenticated
using ((select private.has_azim_role(array['owner'::text,'admin'::text,'sales'::text])));

commit;