-- Phase 2A: standalone Digital Product domain and admin-only cover Storage.
-- Purchasing, downloadable product files, and shared commerce are intentionally out of scope.

create table public.digital_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (
    name = btrim(name)
    and char_length(name) between 1 and 160
  ),
  slug text not null unique check (
    slug = btrim(slug)
    and char_length(slug) between 1 and 120
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  description text not null check (
    description = btrim(description)
    and char_length(description) between 1 and 5000
  ),
  image_path text not null unique check (
    image_path = btrim(image_path)
    and char_length(image_path) between 10 and 512
    and image_path ~ '^products/[A-Za-z0-9][A-Za-z0-9._-]*$'
    and position('..' in image_path) = 0
  ),
  price_amount bigint not null check (
    price_amount >= 0
    and price_amount <= 9007199254740991
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index digital_products_created_order
  on public.digital_products (created_at desc, id);

create trigger digital_products_touch_updated_at
before update on public.digital_products
for each row execute function public.touch_updated_at();

alter table public.digital_products enable row level security;

create policy digital_products_admin_read
on public.digital_products for select to authenticated
using (public.is_admin());

create policy digital_products_admin_insert
on public.digital_products for insert to authenticated
with check (public.is_admin());

create policy digital_products_admin_update
on public.digital_products for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy digital_products_admin_delete
on public.digital_products for delete to authenticated
using (public.is_admin());

revoke all on public.digital_products from anon, authenticated;
grant select on public.digital_products to authenticated;
grant insert (name, slug, description, image_path, price_amount),
  update (name, slug, description, image_path, price_amount), delete
  on public.digital_products to authenticated;
grant all on public.digital_products to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'digital-product-images',
  'digital-product-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy digital_product_images_admin_read
on storage.objects for select to authenticated
using (
  bucket_id = 'digital-product-images'
  and split_part(name, '/', 1) = 'products'
  and public.is_admin()
);

create policy digital_product_images_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'digital-product-images'
  and split_part(name, '/', 1) = 'products'
  and public.is_admin()
);

create policy digital_product_images_admin_update
on storage.objects for update to authenticated
using (
  bucket_id = 'digital-product-images'
  and split_part(name, '/', 1) = 'products'
  and public.is_admin()
)
with check (
  bucket_id = 'digital-product-images'
  and split_part(name, '/', 1) = 'products'
  and public.is_admin()
);

create policy digital_product_images_admin_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'digital-product-images'
  and split_part(name, '/', 1) = 'products'
  and public.is_admin()
);
