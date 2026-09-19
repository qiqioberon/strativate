-- Profile avatar storage: deterministic private object path, with legacy avatar_url retained as fallback.
alter table public.profiles add column if not exists avatar_path text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-avatars','profile-avatars',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists profile_avatar_owner_select on storage.objects;
create policy profile_avatar_owner_select on storage.objects for select to authenticated
using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists profile_avatar_owner_insert on storage.objects;
create policy profile_avatar_owner_insert on storage.objects for insert to authenticated
with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists profile_avatar_owner_update on storage.objects;
create policy profile_avatar_owner_update on storage.objects for update to authenticated
using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists profile_avatar_owner_delete on storage.objects;
create policy profile_avatar_owner_delete on storage.objects for delete to authenticated
using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

grant update(avatar_path) on public.profiles to authenticated;
comment on column public.profiles.avatar_path is 'Private Storage object path in profile-avatars. avatar_url remains a legacy fallback.';
