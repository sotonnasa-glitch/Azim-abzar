insert into storage.buckets (id, name, public) values ('catalog-images', 'catalog-images', true) on conflict (id) do update set public = true;

create policy "Temporary catalog image upload" on storage.objects for insert to anon with check (bucket_id = 'catalog-images');