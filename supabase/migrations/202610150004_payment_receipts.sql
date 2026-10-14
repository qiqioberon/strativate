-- One canonical historical transaction read model, shared by customer/admin PDFs.
-- No invoice numbering or email-delivery behavior changes.
create function public.get_payment_receipt(p_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_order from public.orders where id = p_order_id;
  -- Missing and unauthorized orders share the same response.
  if not found or (v_order.user_id <> v_uid and public.is_admin() is distinct from true) then
    raise exception 'Order unavailable' using errcode = 'P0002';
  end if;
  if v_order.status <> 'paid' then
    raise exception 'A receipt is available only for paid orders' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'order_id', o.id, 'invoice', o.invoice_number, 'currency', v_order.currency_code,
    'customer', o.customer, 'email', o.email, 'created_at', o.created_at,
    'paid_at', o.paid_at, 'recognized_at', o.recognized_at, 'legacy_paid', o.legacy_paid,
    'gross', o.gross, 'discount', o.discount, 'net', o.net,
    'discount_code', o.discount_code, 'payment', o.payment,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', i.id, 'name', i.name, 'quantity', i.quantity,
      'gross', i.gross, 'discount', i.discount, 'net', i.net
    ) order by i.created_at, i.id) from public.admin_sales_item_facts i where i.order_id = o.id), '[]'::jsonb)
  ) into v_result from public.admin_sales_order_facts o where o.id = v_order.id;
  return v_result;
end;
$$;
revoke all on function public.get_payment_receipt(uuid) from public, anon;
grant execute on function public.get_payment_receipt(uuid) to authenticated;
comment on function public.get_payment_receipt(uuid) is
  'Paid-order receipt snapshots; restricted to the order owner or an authoritative admin.';
