-- FRESCO-435: Storage bucket for AI-generated recipe photos (Qwen Studio
-- manual pipeline, see scripts/build-photo-prompts.ts +
-- scripts/apply-photo-generations.ts). Existing recipes.foto_url values
-- point to third-party CDNs (Unsplash/Pexels/Pixabay); AI-generated images
-- need somewhere Fresco actually controls. Same governance model as
-- `recipes` itself: public read (served to anon + authenticated the same as
-- any other recipe field), service-role-only write (the apply script uses
-- SUPABASE_SERVICE_ROLE_KEY, never a user-facing upload path).

insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do nothing;

create policy recipe_photos_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'recipe-photos');

create policy recipe_photos_service_role_write
  on storage.objects
  for insert
  to service_role
  with check (bucket_id = 'recipe-photos');

create policy recipe_photos_service_role_update
  on storage.objects
  for update
  to service_role
  using (bucket_id = 'recipe-photos');

create policy recipe_photos_service_role_delete
  on storage.objects
  for delete
  to service_role
  using (bucket_id = 'recipe-photos');
