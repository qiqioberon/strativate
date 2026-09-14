-- Paid ownership remains valid when a product is later unpublished from the storefront.
-- Expose only minimal current protected-content metadata in the owner library RPC.

drop function public.list_owned_digital_products();
create function public.list_owned_digital_products()
returns table (
  order_item_id uuid,
  order_id uuid,
  commerce_item_id uuid,
  name_snapshot text,
  slug_snapshot text,
  unit_price_amount bigint,
  purchased_at timestamptz,
  current_image_path text,
  current_content_type text,
  content_ready boolean
)
language sql stable security definer set search_path = '' as $$
  select
    oi.id,
    o.id,
    oi.commerce_item_id,
    oi.name_snapshot,
    oi.slug_snapshot,
    oi.unit_price_amount,
    o.paid_at,
    dp.image_path,
    dp.content_type,
    (dp.content_type is not null and dp.content_path is not null and dp.content_mime_type is not null)
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  left join public.digital_products dp on dp.id = oi.commerce_item_id
  where o.user_id = public.current_completed_mentee_id()
    and o.status = 'paid'
    and oi.item_kind_snapshot = 'digital_product'
  order by o.paid_at desc, oi.created_at desc, oi.id
$$;

revoke all on function public.list_owned_digital_products() from public, anon, authenticated;
grant execute on function public.list_owned_digital_products() to authenticated, service_role;

create or replace function public.create_digital_product_access_session(p_product_id uuid)
returns table (
  session_id uuid,
  product_id uuid,
  content_type text,
  content_path text,
  content_mime_type text,
  content_file_name text,
  order_id uuid,
  order_item_id uuid,
  expires_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_product public.digital_products;
  v_order_id uuid;
  v_order_item_id uuid;
  v_session public.digital_product_access_sessions;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_product
  from public.digital_products dp
  where dp.id = p_product_id;

  if not found
    or v_product.content_type is null
    or v_product.content_path is null
    or v_product.content_mime_type is null then
    raise exception 'Digital Product content is unavailable' using errcode = '22023';
  end if;

  if not public.is_admin() then
    select o.id, oi.id
      into v_order_id, v_order_item_id
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.commerce_items ci on ci.id = oi.commerce_item_id
    where o.user_id = v_uid
      and o.status = 'paid'
      and oi.item_kind_snapshot = 'digital_product'
      and ci.item_kind = 'digital_product'
      and ci.id = p_product_id
    order by coalesce(o.paid_at, o.updated_at) desc, oi.created_at desc
    limit 1;

    if v_order_item_id is null then
      raise exception 'Paid Digital Product ownership required' using errcode = '42501';
    end if;
  end if;

  insert into public.digital_product_access_sessions (user_id, product_id, order_id, order_item_id)
  values (v_uid, v_product.id, v_order_id, v_order_item_id)
  returning * into v_session;

  return query select
    v_session.id,
    v_product.id,
    v_product.content_type,
    v_product.content_path,
    v_product.content_mime_type,
    v_product.content_file_name,
    v_order_id,
    v_order_item_id,
    v_session.expires_at;
end;
$$;

revoke all on function public.create_digital_product_access_session(uuid) from public, anon, authenticated;
grant execute on function public.create_digital_product_access_session(uuid) to authenticated, service_role;
