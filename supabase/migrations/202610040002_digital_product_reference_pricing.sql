-- Add optional display-only reference pricing for Digital Products.
-- price_amount remains authoritative for Cart, Orders, discounts, and payment.

alter table public.digital_products
  add column if not exists reference_price_amount bigint;

alter table public.digital_products
  drop constraint if exists digital_products_reference_price_amount_check;

alter table public.digital_products
  add constraint digital_products_reference_price_amount_check
  check (
    reference_price_amount is null
    or (
      reference_price_amount >= price_amount
      and reference_price_amount <= 9007199254740991
    )
  );

grant insert (reference_price_amount), update (reference_price_amount)
  on public.digital_products to authenticated;

-- Keep reference_price_amount out of resolve_commerce_item() so commerce math
-- continues to resolve solely from the authoritative price_amount.
drop function if exists public.get_active_cart();

create function public.get_active_cart()
returns table (
  cart_id uuid,
  cart_item_id uuid,
  commerce_item_id uuid,
  item_kind text,
  name text,
  slug text,
  image_path text,
  price_amount bigint,
  reference_price_amount bigint,
  is_available boolean,
  created_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  v_cart public.carts := public.get_or_create_active_cart();
begin
  return query
  select
    v_cart.id,
    ci.id,
    ci.commerce_item_id,
    r.item_kind,
    r.name,
    r.slug,
    r.image_path,
    r.price_amount,
    case when r.item_kind = 'digital_product' then dp.reference_price_amount end,
    r.is_available,
    ci.created_at
  from public.cart_items ci
  cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
  left join public.digital_products dp
    on r.item_kind = 'digital_product' and dp.id = ci.commerce_item_id
  where ci.cart_id = v_cart.id
  order by ci.created_at, ci.id;
end;
$$;

revoke all on function public.get_active_cart() from public, anon, authenticated;
grant execute on function public.get_active_cart() to authenticated, service_role;
