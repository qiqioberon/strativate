-- Homepage Digital Product showcase controls for the React Bits Card Swap.
-- Existing published products keep a small default showcase so rollout does not blank the homepage.

alter table public.digital_products
  add column homepage_featured boolean not null default false,
  add column homepage_featured_order integer not null default 0
    check (homepage_featured_order between 0 and 9999);

create index digital_products_homepage_showcase_order
  on public.digital_products (homepage_featured_order, created_at desc, id)
  where homepage_featured and is_published;

with initial_showcase as (
  select id, row_number() over (order by created_at desc, id) - 1 as showcase_order
  from public.digital_products
  where is_published
  order by created_at desc, id
  limit 5
)
update public.digital_products as product
set homepage_featured = true,
    homepage_featured_order = initial_showcase.showcase_order
from initial_showcase
where product.id = initial_showcase.id;

grant insert (homepage_featured, homepage_featured_order),
  update (homepage_featured, homepage_featured_order)
  on public.digital_products to authenticated;
