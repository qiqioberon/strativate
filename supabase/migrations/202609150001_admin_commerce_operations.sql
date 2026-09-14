-- Admin operational reporting over the existing Shared Commerce domain.
-- Keeps owner-facing RLS intact and exposes only admin-guarded read models.

create function public.list_admin_commerce_orders(
  p_query text default '',
  p_status text default '',
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  total_count bigint,
  order_id uuid,
  user_id uuid,
  user_email text,
  created_at timestamptz,
  paid_at timestamptz,
  order_status text,
  total_amount bigint,
  item_count bigint,
  item_summary text,
  items jsonb,
  payment jsonb
)
language sql stable security definer set search_path = '' as $$
  with filtered as (
    select o.*
    from public.orders o
    join auth.users u on u.id = o.user_id
    where public.is_admin()
      and (p_from is null or o.created_at >= p_from)
      and (p_to is null or o.created_at < p_to)
      and (
        btrim(coalesce(p_status, '')) = ''
        or o.status = btrim(p_status)
        or exists (
          select 1 from public.payment_attempts pa
          where pa.order_id = o.id and pa.status = btrim(p_status)
        )
      )
      and (
        btrim(coalesce(p_query, '')) = ''
        or o.id::text ilike '%' || btrim(p_query) || '%'
        or coalesce(u.email, '') ilike '%' || btrim(p_query) || '%'
        or exists (
          select 1 from public.order_items oi
          where oi.order_id = o.id and oi.name_snapshot ilike '%' || btrim(p_query) || '%'
        )
      )
  ), paged as (
    select f.*, count(*) over() as total_count
    from filtered f
    order by f.created_at desc, f.id desc
    limit greatest(1, least(coalesce(p_limit, 20), 5000))
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select
    p.total_count,
    p.id,
    p.user_id,
    coalesce(u.email, ''),
    p.created_at,
    p.paid_at,
    p.status,
    p.total_amount,
    coalesce(item_data.item_count, 0),
    coalesce(item_data.item_summary, 'Pesanan Strativate'),
    coalesce(item_data.items, '[]'::jsonb),
    payment_data.payment
  from paged p
  join auth.users u on u.id = p.user_id
  left join lateral (
    select
      count(*)::bigint as item_count,
      (array_agg(oi.name_snapshot order by oi.created_at, oi.id))[1] || case when count(*) > 1 then ' +' || (count(*) - 1)::text || ' item lainnya' else '' end as item_summary,
      jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'commerceItemId', oi.commerce_item_id,
          'kind', oi.item_kind_snapshot,
          'name', oi.name_snapshot,
          'quantity', 1,
          'unitPrice', oi.unit_price_amount,
          'subtotal', oi.unit_price_amount,
          'createdAt', oi.created_at
        ) order by oi.created_at, oi.id
      ) as items
    from public.order_items oi
    where oi.order_id = p.id
  ) item_data on true
  left join lateral (
    select jsonb_build_object(
      'id', pa.id,
      'provider', pa.provider,
      'providerOrderId', pa.provider_order_id,
      'providerTransactionId', pa.provider_transaction_id,
      'providerStatus', pa.provider_status,
      'fraudStatus', pa.fraud_status,
      'paymentType', pa.payment_type,
      'grossAmount', pa.gross_amount,
      'status', pa.status,
      'createdAt', pa.created_at,
      'updatedAt', pa.updated_at
    ) as payment
    from public.payment_attempts pa
    where pa.order_id = p.id
    order by pa.created_at desc, pa.id desc
    limit 1
  ) payment_data on true
  order by p.created_at desc, p.id desc;
$$;

create function public.get_admin_commerce_report(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  total_revenue bigint,
  total_transactions bigint,
  paid_orders bigint,
  pending_orders bigint,
  customer_count bigint,
  average_order_value numeric,
  total_users bigint,
  total_mentors bigint,
  total_sessions bigint,
  sessions_today bigint,
  pending_sessions bigint,
  trend jsonb,
  product_distribution jsonb,
  best_sellers jsonb
)
language sql stable security definer set search_path = '' as $$
  with scoped_orders as (
    select o.*
    from public.orders o
    where public.is_admin()
      and (p_from is null or o.created_at >= p_from)
      and (p_to is null or o.created_at < p_to)
  ), metrics as (
    select
      coalesce(sum(total_amount) filter (where status = 'paid'), 0)::bigint as total_revenue,
      count(*)::bigint as total_transactions,
      count(*) filter (where status = 'paid')::bigint as paid_orders,
      count(*) filter (where status = 'pending_payment')::bigint as pending_orders,
      count(distinct user_id)::bigint as customer_count,
      coalesce(avg(total_amount) filter (where status = 'paid'), 0)::numeric as average_order_value
    from scoped_orders
  ), daily as (
    select
      date_trunc('day', created_at)::date as day,
      coalesce(sum(total_amount) filter (where status = 'paid'), 0)::bigint as revenue,
      count(*)::bigint as transactions
    from scoped_orders
    group by 1
    order by 1
  ), distribution as (
    select oi.item_kind_snapshot as kind, count(*)::bigint as quantity
    from scoped_orders o
    join public.order_items oi on oi.order_id = o.id
    group by oi.item_kind_snapshot
    order by count(*) desc, oi.item_kind_snapshot
  ), sellers as (
    select
      oi.name_snapshot as name,
      oi.item_kind_snapshot as kind,
      count(*)::bigint as quantity,
      coalesce(sum(oi.unit_price_amount), 0)::bigint as revenue
    from scoped_orders o
    join public.order_items oi on oi.order_id = o.id
    where o.status = 'paid'
    group by oi.name_snapshot, oi.item_kind_snapshot
    order by count(*) desc, sum(oi.unit_price_amount) desc, oi.name_snapshot
    limit 8
  )
  select
    m.total_revenue,
    m.total_transactions,
    m.paid_orders,
    m.pending_orders,
    m.customer_count,
    m.average_order_value,
    (select count(*)::bigint from public.profiles where role = 'mentee'::public.app_role),
    (select count(*)::bigint from public.mentor_profiles where is_active),
    (select count(*)::bigint from public.private_mentoring_sessions),
    (select count(*)::bigint from public.private_mentoring_sessions where status = 'scheduled' and (scheduled_start_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date),
    (select count(*)::bigint from public.private_mentoring_sessions where status in ('awaiting_focus', 'awaiting_scheduling')),
    coalesce((select jsonb_agg(jsonb_build_object('date', day, 'revenue', revenue, 'transactions', transactions) order by day) from daily), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'quantity', quantity) order by quantity desc, kind) from distribution), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('name', name, 'kind', kind, 'quantity', quantity, 'revenue', revenue) order by quantity desc, revenue desc, name) from sellers), '[]'::jsonb)
  from metrics m
  where public.is_admin();
$$;


create function public.list_admin_purchasable_commerce_items(p_query text default '')
returns table (
  commerce_item_id uuid,
  item_kind text,
  name text,
  slug text,
  price_amount bigint,
  description text,
  image_path text
)
language sql stable security definer set search_path = '' as $$
  select r.commerce_item_id, r.item_kind, r.name, r.slug, r.price_amount, r.description, r.image_path
  from public.commerce_items ci
  cross join lateral public.resolve_commerce_item(ci.id) r
  where public.is_admin()
    and r.is_available
    and r.name is not null
    and r.price_amount is not null
    and (btrim(coalesce(p_query,'')) = '' or concat_ws(' ', r.name, r.slug, r.item_kind) ilike '%' || btrim(p_query) || '%')
  order by r.item_kind, r.name, r.commerce_item_id
  limit 100;
$$;

create function public.list_admin_cart_links_page(
  p_query text default '',
  p_status text default '',
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  total_count bigint,
  id uuid,
  mentee_id uuid,
  mentee_email text,
  creator_email text,
  status text,
  item_count bigint,
  created_at timestamptz,
  claimed_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  with rows as (
    select
      l.id,
      l.mentee_id,
      coalesce(mentee.email, '') as mentee_email,
      coalesce(creator.email, '') as creator_email,
      l.status,
      count(li.commerce_item_id)::bigint as item_count,
      l.created_at,
      l.claimed_at
    from public.commerce_cart_links l
    join auth.users mentee on mentee.id = l.mentee_id
    left join auth.users creator on creator.id = l.created_by
    left join public.commerce_cart_link_items li on li.cart_link_id = l.id
    where public.is_admin()
      and (btrim(coalesce(p_status, '')) = '' or l.status = btrim(p_status))
      and (
        btrim(coalesce(p_query, '')) = ''
        or l.id::text ilike '%' || btrim(p_query) || '%'
        or coalesce(mentee.email, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(creator.email, '') ilike '%' || btrim(p_query) || '%'
      )
    group by l.id, mentee.email, creator.email
  )
  select count(*) over(), r.*
  from rows r
  order by r.created_at desc, r.id desc
  limit greatest(1, least(coalesce(p_limit, 10), 100))
  offset greatest(coalesce(p_offset, 0), 0);
$$;


create function public.get_admin_commerce_item_detail(p_commerce_item_id uuid)
returns table (
  commerce_item_id uuid,
  item_kind text,
  name text,
  slug text,
  description text,
  image_path text,
  price_amount bigint,
  is_available boolean,
  session_count integer,
  mentor_tier_name text,
  content_type text
)
language sql stable security definer set search_path = '' as $$
  select
    r.commerce_item_id,
    r.item_kind,
    r.name,
    r.slug,
    r.description,
    r.image_path,
    r.price_amount,
    r.is_available,
    pkg.session_count,
    tier.name,
    dp.content_type::text
  from public.resolve_commerce_item(p_commerce_item_id) r
  left join public.private_mentoring_packages pkg
    on r.item_kind = 'private_mentoring' and pkg.id = r.commerce_item_id
  left join public.mentor_tiers tier on tier.id = pkg.mentor_tier_id
  left join public.digital_products dp on r.item_kind = 'digital_product' and dp.id = r.commerce_item_id
  where public.is_admin();
$$;

revoke all on function public.list_admin_commerce_orders(text,text,timestamptz,timestamptz,integer,integer) from public, anon;
revoke all on function public.get_admin_commerce_report(timestamptz,timestamptz) from public, anon;
revoke all on function public.list_admin_purchasable_commerce_items(text) from public, anon;
revoke all on function public.list_admin_cart_links_page(text,text,integer,integer) from public, anon;
revoke all on function public.get_admin_commerce_item_detail(uuid) from public, anon;
grant execute on function public.list_admin_commerce_orders(text,text,timestamptz,timestamptz,integer,integer) to authenticated;
grant execute on function public.get_admin_commerce_report(timestamptz,timestamptz) to authenticated;
grant execute on function public.list_admin_purchasable_commerce_items(text) to authenticated;
grant execute on function public.list_admin_cart_links_page(text,text,integer,integer) to authenticated;
grant execute on function public.get_admin_commerce_item_detail(uuid) to authenticated;
