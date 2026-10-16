-- Keep private cover originals and crops so admins can re-adjust Digital Product covers.
-- Existing derivative-only covers stay valid; null source/crop identifies a legacy cover.
alter table public.digital_products
  add column if not exists image_source_path text,
  add column if not exists image_crop jsonb;

alter table public.digital_products
  drop constraint if exists digital_products_image_source_path_check,
  drop constraint if exists digital_products_image_crop_check;

alter table public.digital_products
  add constraint digital_products_image_source_path_check check (
    image_source_path is null or image_source_path ~ '^digital-products/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ),
  add constraint digital_products_image_crop_check check (
    image_crop is null or coalesce((
      jsonb_typeof(image_crop) = 'object'
      and jsonb_typeof(image_crop->'x') = 'number'
      and jsonb_typeof(image_crop->'y') = 'number'
      and jsonb_typeof(image_crop->'width') = 'number'
      and jsonb_typeof(image_crop->'height') = 'number'
      and (image_crop->>'x')::numeric between 0 and 1
      and (image_crop->>'y')::numeric between 0 and 1
      and (image_crop->>'width')::numeric > 0 and (image_crop->>'width')::numeric <= 1
      and (image_crop->>'height')::numeric > 0 and (image_crop->>'height')::numeric <= 1
      and (image_crop->>'x')::numeric + (image_crop->>'width')::numeric <= 1.000001
      and (image_crop->>'y')::numeric + (image_crop->>'height')::numeric <= 1.000001
    ), false)
  );

-- Extend the shared private-original upload policy with the Digital Product prefix.
update storage.buckets set public = false where id = 'marketing-photo-sources';
drop policy if exists marketing_photo_sources_admin_insert on storage.objects;
create policy marketing_photo_sources_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marketing-photo-sources'
    and public.is_admin()
    and split_part(name, '/', 1) in (
      'publications', 'competitions', 'testimonials', 'who-we-are',
      'competition-recognitions', 'trusted-partners', 'about-featured-stories', 'about-us',
      'digital-products'
    )
    and name !~ '(^|/)\.\.(/|$)'
    and name not like '%//%'
    and name ~* '\.(jpe?g|png|webp)$'
  );

-- RLS still restricts mutations to admins. Never grant public access to source/crop columns.
grant insert (image_source_path, image_crop), update (image_source_path, image_crop)
  on public.digital_products to authenticated;
revoke select on public.digital_products from anon, authenticated;
grant select (
  id, name, slug, description, image_path, price_amount, reference_price_amount,
  content_type, content_path, content_mime_type, content_file_name, content_size_bytes,
  page_count, duration_seconds, is_published, homepage_featured, homepage_featured_order,
  show_sales_count, show_rating, created_at, updated_at
) on public.digital_products to anon, authenticated;

create or replace function public.admin_list_digital_products()
returns setof public.digital_products
language sql stable security definer set search_path = '' as $$
  select product.* from public.digital_products product
  where public.is_admin()
  order by product.name, product.id;
$$;

revoke all on function public.admin_list_digital_products() from public, anon, authenticated;
grant execute on function public.admin_list_digital_products() to authenticated;

comment on column public.digital_products.image_source_path is 'Admin-only private original; null identifies a legacy derivative-only cover.';
comment on column public.digital_products.image_crop is 'Admin-only normalized x/y/width/height crop in source-image coordinates.';
