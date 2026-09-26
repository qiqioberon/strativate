-- Resolve the PL/pgSQL output-column/discount-code lookup ambiguity without rewriting applied migrations.
-- Forward-only follow-up to 202609260002_commerce_discount_scope_sales_count_fix.sql.

create or replace function public.apply_discount_code(p_cart_id uuid, p_code text)
returns table (cart_id uuid, subtotal_amount bigint, discount_amount bigint, total_amount bigint, code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.current_completed_mentee_id();
  v_cart public.carts;
  v_code public.commerce_discount_codes;
  v_subtotal bigint;
  v_eligible_subtotal bigint;
  v_discount bigint;
  v_capacity_used bigint;
begin
  select * into v_cart
  from public.carts
  where id = p_cart_id and user_id = v_uid and status = 'active'
  for update;
  if not found then raise exception 'Cart not found' using errcode = '42501'; end if;

  select dc.* into v_code
  from public.commerce_discount_codes dc
  where dc.code = upper(btrim(coalesce(p_code, '')))
  for update;
  if not found
    or not v_code.is_active
    or (v_code.starts_at is not null and now() < v_code.starts_at)
    or (v_code.ends_at is not null and now() >= v_code.ends_at)
  then
    raise exception 'Discount code is invalid or expired' using errcode = '22023';
  end if;

  if v_cart.discount_code_id = v_code.id then
    raise exception 'Discount code is already applied' using errcode = '22023';
  end if;

  select public.discount_redemption_capacity_used(v_code.id) into v_capacity_used;
  if v_code.max_redemptions is not null and v_capacity_used >= v_code.max_redemptions then
    raise exception 'Discount code has reached its redemption limit' using errcode = '22023';
  end if;

  select coalesce(sum(r.price_amount), 0)::bigint
  into v_subtotal
  from public.cart_items ci
  cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
  where ci.cart_id = v_cart.id;

  select coalesce(sum(r.price_amount), 0)::bigint
  into v_eligible_subtotal
  from public.cart_items ci
  cross join lateral public.resolve_commerce_item(ci.commerce_item_id) r
  where ci.cart_id = v_cart.id
    and r.item_kind = 'digital_product'
    and (
      v_code.scope = 'digital_products'
      or (
        v_code.scope = 'selected_digital_products'
        and exists (
          select 1
          from public.commerce_discount_code_products dcp
          where dcp.discount_code_id = v_code.id
            and dcp.product_id = ci.commerce_item_id
        )
      )
    );

  if v_eligible_subtotal <= 0 then
    raise exception 'Discount code is not compatible with items in this cart' using errcode = '22023';
  end if;
  if v_eligible_subtotal < v_code.minimum_subtotal_amount then
    raise exception 'Eligible Digital Product subtotal does not meet the discount minimum' using errcode = '22023';
  end if;

  v_discount := least(
    v_eligible_subtotal,
    case
      when v_code.discount_type = 'percentage'
        then floor(v_eligible_subtotal * least(v_code.discount_value, 100) / 100.0)::bigint
      else v_code.discount_value
    end
  );

  update public.carts
  set discount_code_id = v_code.id,
      discount_code_snapshot = v_code.code,
      discount_amount = v_discount
  where id = v_cart.id;

  return query
  select v_cart.id, v_subtotal, v_discount, v_subtotal - v_discount, v_code.code;
end;
$$;

grant execute on function public.apply_discount_code(uuid, text) to authenticated;
