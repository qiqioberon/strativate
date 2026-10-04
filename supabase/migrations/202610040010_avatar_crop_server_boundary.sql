-- Keep avatar crop metadata and original source paths behind the server-owned avatar API.
-- The service-role API continues to update these fields; browser sessions cannot point the API at another user's private object.

revoke update (avatar_source_path, avatar_crop) on public.profiles from authenticated;

comment on column public.profiles.avatar_source_path is
  'Owner-private original source path managed only by the server avatar API.';
comment on column public.profiles.avatar_crop is
  'Normalized avatar crop metadata managed only by the server avatar API.';
