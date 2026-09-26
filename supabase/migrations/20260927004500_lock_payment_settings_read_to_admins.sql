begin;

drop policy if exists "Staff read site content" on public.site_content;

create policy "Staff read site content"
on public.site_content
for select to authenticated
using (
  (select private.has_azim_role(array['owner'::text,'admin'::text,'editor'::text]))
  and (
    section_key <> 'checkout_payment'
    or (select private.has_azim_role(array['owner'::text,'admin'::text]))
  )
);

commit;