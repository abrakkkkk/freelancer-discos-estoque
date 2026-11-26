-- Fotos próprias de capa (discos, cds, dvds, vhs) tiradas pela câmera do estoque.
-- Leitura pública para a vitrine exibir capa_url; escrita só pelo dono do estoque.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('capas', 'capas', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists capas_owner_insert on storage.objects;
drop policy if exists capas_owner_update on storage.objects;
drop policy if exists capas_owner_delete on storage.objects;

create policy capas_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'capas' and auth.uid() = 'ca73f36d-5a03-48e2-89af-a1e8c4832560'::uuid);
create policy capas_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'capas' and auth.uid() = 'ca73f36d-5a03-48e2-89af-a1e8c4832560'::uuid)
  with check (bucket_id = 'capas' and auth.uid() = 'ca73f36d-5a03-48e2-89af-a1e8c4832560'::uuid);
create policy capas_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'capas' and auth.uid() = 'ca73f36d-5a03-48e2-89af-a1e8c4832560'::uuid);
