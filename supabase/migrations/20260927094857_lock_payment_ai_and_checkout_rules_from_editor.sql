begin;
drop policy if exists "Staff read site content" on public.site_content;
drop policy if exists "Staff insert allowed site content" on public.site_content;
drop policy if exists "Staff update allowed site content" on public.site_content;
drop policy if exists "Staff delete allowed site content" on public.site_content;

create policy "Owner admin read all site content"
on public.site_content for select to authenticated
using (private.has_azim_role(ARRAY['owner','admin']));

create policy "Owner admin write site content"
on public.site_content for insert to authenticated
with check (private.has_azim_role(ARRAY['owner','admin']));

create policy "Owner admin update site content"
on public.site_content for update to authenticated
using (private.has_azim_role(ARRAY['owner','admin']))
with check (private.has_azim_role(ARRAY['owner','admin']));

create policy "Owner admin delete site content"
on public.site_content for delete to authenticated
using (private.has_azim_role(ARRAY['owner','admin']));

create policy "Editor read non-sensitive site content"
on public.site_content for select to authenticated
using (
  private.has_azim_role(ARRAY['editor'])
  and section_key not in ('checkout_payment','ai_settings','checkout_rules')
);

create policy "Editor insert non-sensitive site content"
on public.site_content for insert to authenticated
with check (
  private.has_azim_role(ARRAY['editor'])
  and section_key not in ('checkout_payment','ai_settings','checkout_rules')
);

create policy "Editor update non-sensitive site content"
on public.site_content for update to authenticated
using (
  private.has_azim_role(ARRAY['editor'])
  and section_key not in ('checkout_payment','ai_settings','checkout_rules')
)
with check (
  private.has_azim_role(ARRAY['editor'])
  and section_key not in ('checkout_payment','ai_settings','checkout_rules')
);

create policy "Editor delete non-sensitive site content"
on public.site_content for delete to authenticated
using (
  private.has_azim_role(ARRAY['editor'])
  and section_key not in ('checkout_payment','ai_settings','checkout_rules')
);
commit;