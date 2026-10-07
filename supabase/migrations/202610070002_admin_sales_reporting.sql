-- Dedicated owner/admin sales read models. Existing operational RPCs are retained.
-- This migration neither rewrites historical snapshots nor changes payment state.

-- Existing indexes cover per-order items, attempts, invoices and buyer history.
-- These two indexes add the missing global creation/payment reporting paths.
create index if not exists orders_sales_created_at_idx
  on public.orders (created_at desc, id);
create index if not exists orders_sales_paid_at_idx
  on public.orders (paid_at, user_id, id) where status = 'paid';

create function public.admin_sales_category(p_kind text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_kind = 'digital_product' then 'digital'
    when p_kind = 'private_mentoring' then 'private'
    when p_kind in ('intensive_mentoring_package', 'intensive_mentoring_add_on',
                    'intensive_mentoring_bundle', 'intensive_mentoring_custom_offer') then 'intensive'
    else 'other'
  end;
$$;

create function public.admin_sales_totals(
  p_gross numeric, p_discount numeric, p_net numeric,
  p_orders bigint, p_units bigint, p_buyers bigint
)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'gross', coalesce(p_gross, 0), 'discount', coalesce(p_discount, 0),
    'net', coalesce(p_net, 0), 'orders', coalesce(p_orders, 0),
    'units', coalesce(p_units, 0), 'buyers', coalesce(p_buyers, 0),
    'aov', case when coalesce(p_orders, 0) = 0 then 0 else coalesce(p_net, 0) / p_orders end
  );
$$;

-- Internal views have no browser-facing grants. Only the guarded SECURITY DEFINER
-- RPCs below can read them. One selected attempt per order prevents retry inflation.
create view public.admin_sales_order_facts as
select o.id, o.user_id, o.status, o.invoice_number, o.created_at, o.updated_at, o.paid_at,
  -- September 26 added subtotal DEFAULT 0 without backfilling existing orders.
  -- Recover only that legacy zero case; never recompute from current catalog prices.
  case when o.subtotal_amount = 0 and o.total_amount + o.discount_amount > 0
    then o.total_amount + o.discount_amount else o.subtotal_amount end as gross,
  o.discount_amount as discount, o.total_amount as net,
  coalesce(nullif(o.discount_code_snapshot, ''), nullif(redemption.code_snapshot, '')) as discount_code,
  nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), '') as customer,
  account.email::text as email,
  -- Authoritative paid_at always wins. Legacy records lacking it use the paid
  -- attempt's last transition time, then the existing invoice migration's
  -- updated_at/created_at fallback. Every financial/date read shares this rule.
  case when o.status = 'paid' then coalesce(o.paid_at,
    case when attempt.status = 'paid' then attempt.updated_at end,
    o.updated_at, o.created_at) end as recognized_at,
  o.status = 'paid' and o.paid_at is null as legacy_paid,
  nullif(btrim(attempt.payment_type), '') as payment_method,
  attempt.provider_transaction_id as payment_reference,
  case when attempt.id is null then null else jsonb_build_object(
    'provider', attempt.provider, 'method', nullif(btrim(attempt.payment_type), ''),
    'status', attempt.status, 'provider_status', attempt.provider_status,
    'reference', attempt.provider_transaction_id, 'provider_order_id', attempt.provider_order_id,
    'updated_at', attempt.updated_at
  ) end as payment
from public.orders o
left join public.profiles profile on profile.id = o.user_id
left join auth.users account on account.id = o.user_id
left join public.commerce_discount_redemptions redemption on redemption.order_id = o.id
left join lateral (
  select pa.* from public.payment_attempts pa where pa.order_id = o.id
  order by (o.status = 'paid' and pa.status = 'paid') desc,
    pa.updated_at desc, pa.created_at desc, pa.id desc
  limit 1
) attempt on true;

create view public.admin_sales_item_facts as
select oi.id, oi.order_id, oi.commerce_item_id, oi.item_kind_snapshot as kind,
  oi.name_snapshot as name, oi.slug_snapshot, oi.created_at,
  public.admin_sales_category(oi.item_kind_snapshot) as category,
  1::integer as quantity, oi.unit_price_amount as gross,
  oi.unit_price_amount - coalesce(oi.discounted_unit_price_amount, oi.unit_price_amount) as discount,
  coalesce(oi.discounted_unit_price_amount, oi.unit_price_amount) as net,
  tier.id::text as tier_key, tier.name as tier,
  -- Canonical Private package identity is immutable. Flexible offer/session and
  -- fulfilled top-up records are historical sources; enrollment totals are mutable.
  case when oi.item_kind_snapshot = 'private_mentoring'
    then coalesce(top_up.added_sessions, offer.session_count, package.session_count) end as sessions,
  case when oi.item_kind_snapshot = 'private_mentoring' then
    case when top_up.id is not null then 'top_up'
      when offer.id is not null then offer.mode
      when package.id is not null then 'new_enrollment' end
  end as purchase_type,
  -- Competition scope is source metadata where available; it was not snapshotted
  -- on order_items. Missing/deleted sources remain reportable with null metadata.
  case when oi.item_kind_snapshot = 'intensive_mentoring_package' then intensive.competition_scope
    when oi.item_kind_snapshot = 'intensive_mentoring_custom_offer' then 'international' end as competition_scope,
  -- Only package entitlement snapshots define this comparable package metric.
  -- Do not substitute a mutable catalog/engagement session total, or a bundle's max.
  case when oi.item_kind_snapshot = 'intensive_mentoring_package'
    then entitlement.purchased_sessions end as sessions_per_month
from public.order_items oi
left join public.private_mentoring_packages package
  on oi.item_kind_snapshot = 'private_mentoring' and package.id = oi.commerce_item_id
left join public.private_mentoring_cart_link_offers offer
  on oi.item_kind_snapshot = 'private_mentoring' and offer.id = oi.commerce_item_id
left join public.private_mentoring_top_ups top_up on top_up.order_item_id = oi.id
left join public.mentor_tiers tier on tier.id = coalesce(offer.mentor_tier_id, package.mentor_tier_id)
left join public.intensive_mentoring_packages intensive
  on oi.item_kind_snapshot = 'intensive_mentoring_package' and intensive.id = oi.commerce_item_id
left join public.intensive_mentoring_entitlements entitlement
  on oi.item_kind_snapshot = 'intensive_mentoring_package' and entitlement.order_item_id = oi.id;

revoke all on public.admin_sales_order_facts, public.admin_sales_item_facts
  from public, anon, authenticated;
revoke all on function public.admin_sales_category(text),
  public.admin_sales_totals(numeric, numeric, numeric, bigint, bigint, bigint)
  from public, anon, authenticated;

-- Internal shared selection keeps table/export filters identical. Paid rows use
-- recognition time; unpaid lifecycle rows use creation time. Scope selects matching
-- orders, retaining COMPLETE order amounts/all items for transaction reconciliation.
create function public.admin_sales_filtered_orders(
  p_from date, p_to date, p_scope text, p_query text, p_status text, p_payment text
)
returns setof public.admin_sales_order_facts
language plpgsql stable security definer set search_path = '' as $$
declare
  v_to date := coalesce(p_to, (now() at time zone 'Asia/Jakarta')::date);
  v_start timestamptz := p_from::timestamp at time zone 'Asia/Jakarta';
  v_end timestamptz;
  v_scope text := lower(btrim(coalesce(p_scope, 'all')));
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_payment text := btrim(coalesce(p_payment, ''));
begin
  if public.is_admin() is distinct from true then raise exception 'Admin required' using errcode = '42501'; end if;
  if v_status = 'all' then v_status := ''; end if;
  if lower(v_payment) = 'all' then v_payment := ''; end if;
  if v_scope not in ('all', 'digital', 'private', 'intensive') then
    raise exception 'Invalid sales scope' using errcode = '22023';
  end if;
  if v_status not in ('', 'paid', 'pending_payment', 'payment_failed', 'expired', 'cancelled') then
    raise exception 'Invalid order status' using errcode = '22023';
  end if;
  if char_length(v_query) > 200 or char_length(v_payment) > 100
    or v_to not between date '0001-01-01' and date '9999-12-30'
    or (p_from is not null and (p_from < date '0001-01-01' or p_from > v_to)) then
    raise exception 'Invalid sales filters' using errcode = '22023';
  end if;
  v_end := (v_to + 1)::timestamp at time zone 'Asia/Jakarta';
  return query
  select o.* from public.admin_sales_order_facts o
  where (v_status = '' or o.status = v_status)
    and (v_payment = '' or coalesce(o.payment_method, 'unknown') = v_payment)
    and (
      (o.status = 'paid' and (
        (o.paid_at is not null and (v_start is null or o.paid_at >= v_start) and o.paid_at < v_end)
        or (o.paid_at is null and (v_start is null or o.recognized_at >= v_start) and o.recognized_at < v_end)
      )) or (o.status <> 'paid' and (v_start is null or o.created_at >= v_start) and o.created_at < v_end)
    )
    and (v_scope = 'all' or exists (
      select 1 from public.order_items oi where oi.order_id = o.id
        and public.admin_sales_category(oi.item_kind_snapshot) = v_scope
    ))
    -- strpos makes search literal: user '%'/'_' characters are never SQL wildcards.
    and (v_query = '' or strpos(lower(o.id::text), v_query) > 0
      or strpos(lower('STR-' || substr(replace(o.id::text, '-', ''), 1, 8)), v_query) > 0
      or strpos(lower(coalesce(o.invoice_number, '')), v_query) > 0
      or strpos(lower(coalesce(o.customer, '')), v_query) > 0
      or strpos(lower(coalesce(o.email, '')), v_query) > 0
      or strpos(lower(coalesce(o.discount_code, '')), v_query) > 0
      or strpos(lower(coalesce(o.payment_reference, '')), v_query) > 0
      or exists (select 1 from public.order_items oi where oi.order_id = o.id
        and strpos(lower(oi.name_snapshot), v_query) > 0)
    );
end;
$$;
revoke all on function public.admin_sales_filtered_orders(date, date, text, text, text, text)
  from public, anon, authenticated;

create function public.list_admin_sales_transactions(
  p_from date default null, p_to date default null, p_scope text default 'all',
  p_query text default '', p_status text default '', p_payment text default '',
  p_sort text default 'created', p_direction text default 'desc',
  p_limit integer default 25, p_offset integer default 0
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_sort text := lower(btrim(coalesce(p_sort, 'created')));
  v_direction text := lower(btrim(coalesce(p_direction, 'desc')));
  -- The higher bound is for the guarded server export, never ordinary UI pages.
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 50000));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if public.is_admin() is distinct from true then raise exception 'Admin required' using errcode = '42501'; end if;
  if v_sort not in ('created', 'paid', 'net', 'customer', 'status', 'invoice')
    or v_direction not in ('asc', 'desc') then
    raise exception 'Invalid transaction sort' using errcode = '22023';
  end if;
  with filtered as materialized (
    select * from public.admin_sales_filtered_orders(p_from, p_to, p_scope, p_query, p_status, p_payment)
  ), ranked as (
    select o.*, row_number() over (order by
      case when v_sort = 'created' and v_direction = 'asc' then o.created_at end asc nulls last,
      case when v_sort = 'created' and v_direction = 'desc' then o.created_at end desc nulls last,
      case when v_sort = 'paid' and v_direction = 'asc' then o.recognized_at end asc nulls last,
      case when v_sort = 'paid' and v_direction = 'desc' then o.recognized_at end desc nulls last,
      case when v_sort = 'net' and v_direction = 'asc' then o.net end asc nulls last,
      case when v_sort = 'net' and v_direction = 'desc' then o.net end desc nulls last,
      case when v_sort = 'customer' and v_direction = 'asc' then lower(coalesce(o.customer, o.email)) end asc nulls last,
      case when v_sort = 'customer' and v_direction = 'desc' then lower(coalesce(o.customer, o.email)) end desc nulls last,
      case when v_sort = 'status' and v_direction = 'asc' then o.status end asc nulls last,
      case when v_sort = 'status' and v_direction = 'desc' then o.status end desc nulls last,
      case when v_sort = 'invoice' and v_direction = 'asc' then o.invoice_number end asc nulls last,
      case when v_sort = 'invoice' and v_direction = 'desc' then o.invoice_number end desc nulls last,
      o.id desc
    ) as position from filtered o
  ), paged as (
    select * from ranked order by position limit v_limit offset v_offset
  ), transaction_rows as (
    select p.position, jsonb_build_object(
      'order_id', p.id, 'invoice', p.invoice_number, 'user_id', p.user_id,
      'customer', p.customer, 'email', p.email, 'created_at', p.created_at,
      'paid_at', p.paid_at, 'recognized_at', p.recognized_at, 'status', p.status,
      'gross', p.gross, 'discount', p.discount, 'net', p.net, 'discount_code', p.discount_code,
      'item_count', items.item_count, 'item_summary', coalesce(items.item_summary, 'Pesanan Strativate'),
      'items', coalesce(items.items, '[]'::jsonb), 'payment', p.payment
    ) as payload
    from paged p
    cross join lateral (
      select count(*) as item_count,
        (array_agg(i.name order by i.created_at, i.id))[1]
          || case when count(*) > 1 then ' +' || (count(*) - 1)::text || ' item lainnya' else '' end as item_summary,
        jsonb_agg(jsonb_build_object(
          'id', i.id, 'commerce_item_id', i.commerce_item_id, 'name', i.name,
          'kind', i.kind, 'category', i.category, 'quantity', i.quantity,
          'gross', i.gross, 'discount', i.discount, 'net', i.net,
          'tier', i.tier, 'sessions', i.sessions, 'purchase_type', i.purchase_type,
          'competition_scope', i.competition_scope, 'sessions_per_month', i.sessions_per_month
        ) order by i.created_at, i.id) as items
      from public.admin_sales_item_facts i where i.order_id = p.id
    ) items
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(r.payload order by r.position) from transaction_rows r), '[]'::jsonb),
    -- A separate aggregate preserves total_count even for an empty/out-of-range page.
    'total_count', (select count(*) from filtered)
  ) into v_result;
  return v_result;
end;
$$;

create function public.get_admin_sales_report(
  p_from date default null, p_to date default null, p_scope text default 'all',
  p_compare boolean default true, p_granularity text default 'auto'
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_scope text := lower(btrim(coalesce(p_scope, 'all')));
  v_to date := coalesce(p_to, (now() at time zone 'Asia/Jakarta')::date);
  v_from date := p_from;
  v_start timestamptz;
  v_end timestamptz;
  v_previous_start timestamptz;
  v_previous_from date;
  v_previous_to date;
  v_compare boolean := coalesce(p_compare, true) and p_from is not null;
  v_granularity text := lower(btrim(coalesce(p_granularity, 'auto')));
  v_days integer;
  v_result jsonb;
begin
  if public.is_admin() is distinct from true then raise exception 'Admin required' using errcode = '42501'; end if;
  if v_scope not in ('all', 'digital', 'private', 'intensive')
    or v_granularity not in ('auto', 'day', 'week', 'month')
    or v_to not between date '0001-01-01' and date '9999-12-30'
    or (p_from is not null and (p_from < date '0001-01-01' or p_from > v_to)) then
    raise exception 'Invalid report filters' using errcode = '22023';
  end if;
  v_end := (v_to + 1)::timestamp at time zone 'Asia/Jakarta';
  if v_from is null then
    select coalesce((min(least(o.created_at, coalesce(o.recognized_at, o.created_at)))
      at time zone 'Asia/Jakarta')::date, v_to) into v_from
    from public.admin_sales_order_facts o
    where o.created_at < v_end
      and (v_scope = 'all' or exists (
        select 1 from public.order_items oi where oi.order_id = o.id
          and public.admin_sales_category(oi.item_kind_snapshot) = v_scope
      ));
  end if;
  v_days := v_to - v_from + 1;
  v_start := v_from::timestamp at time zone 'Asia/Jakarta';
  if v_compare then
    v_previous_from := v_from - v_days;
    v_previous_to := v_from - 1;
    v_previous_start := v_previous_from::timestamp at time zone 'Asia/Jakarta';
  else
    v_previous_start := v_start;
  end if;
  if v_granularity = 'auto' then
    v_granularity := case when v_days <= 31 then 'day' when v_days <= 180 then 'week' else 'month' end;
  end if;
  -- Explicit daily/weekly requests on long ranges are safely coarsened; the
  -- returned range records the actual granularity. Never emit thousands of points.
  if v_granularity = 'day' and v_days > 366 then v_granularity := 'week'; end if;
  if v_granularity = 'week' and v_days > 2562 then v_granularity := 'month'; end if;
  if v_granularity = 'month'
    and (extract(year from v_to) - extract(year from v_from)) * 12
        + extract(month from v_to) - extract(month from v_from) >= 600 then
    raise exception 'Reporting range exceeds 600 monthly periods' using errcode = '22023';
  end if;

  with category_labels(key, label) as (
    values ('digital', 'Produk Digital'), ('private', 'Private Mentoring'),
      ('intensive', 'Intensive Mentoring'), ('other', 'Lainnya')
  ), paid_facts as materialized (
    select o.id, o.user_id, o.gross, o.discount, o.net, o.legacy_paid, o.discount_code, o.payment_method,
      case when o.recognized_at >= v_start then 1 else 0 end as period,
      (o.recognized_at at time zone 'Asia/Jakarta')::date as sales_date
    from public.admin_sales_order_facts o
    where o.status = 'paid' and (
      (o.paid_at is not null and o.paid_at >= v_previous_start and o.paid_at < v_end)
      or (o.paid_at is null and o.recognized_at >= v_previous_start and o.recognized_at < v_end)
    )
  ), sold_items as materialized (
    select i.*, o.user_id, o.period, o.sales_date
    from paid_facts o join public.admin_sales_item_facts i on i.order_id = o.id
    where v_scope = 'all' or i.category = v_scope
  ), paid_orders as materialized (
    -- Each order contributes once. A scoped mixed order contributes only its
    -- selected category's item values; all-sales uses authoritative order totals.
    select o.id, o.user_id, o.period, o.sales_date, o.legacy_paid, o.discount_code, o.payment_method,
      case when v_scope = 'all' then o.gross else sum(i.gross) end as gross,
      case when v_scope = 'all' then o.discount else sum(i.discount) end as discount,
      case when v_scope = 'all' then o.net else sum(i.net) end as net,
      count(i.id)::bigint as units
    from paid_facts o left join sold_items i on i.order_id = o.id
    where v_scope = 'all' or i.id is not null
    group by o.id, o.user_id, o.period, o.sales_date, o.legacy_paid,
      o.discount_code, o.payment_method, o.gross, o.discount, o.net
  ), period_totals as (
    select period, public.admin_sales_totals(sum(gross), sum(discount), sum(net),
      count(*), sum(units)::bigint, count(distinct user_id)) as metrics
    from paid_orders group by period
  ), bucket_starts as (
    -- Weekly windows start at the requested date; month boundaries are calendar
    -- boundaries clipped to the requested range. Comparison buckets shift those
    -- same boundaries by the exact period length so positions remain comparable.
    select g::date as bucket_from from generate_series(v_from::timestamp, v_to::timestamp,
      case when v_granularity = 'day' then interval '1 day' else interval '7 days' end) g
    where v_granularity <> 'month'
    union all
    select v_from where v_granularity = 'month'
    union all
    select g::date from generate_series(
      date_trunc('month', v_from::timestamp) + interval '1 month', v_to::timestamp, interval '1 month'
    ) g where v_granularity = 'month'
  ), buckets as (
    select row_number() over(order by bucket_from) as position, bucket_from,
      lead(bucket_from, 1, v_to + 1) over(order by bucket_from) as bucket_to
    from bucket_starts
  ), grids as (
    select b.position, p.period,
      b.bucket_from - case when p.period = 0 then v_days else 0 end as bucket_from,
      b.bucket_to - case when p.period = 0 then v_days else 0 end as bucket_to
    from buckets b cross join (values (1), (0)) p(period)
    where p.period = 1 or v_compare
  ), trend_totals as (
    select g.period, g.position, public.admin_sales_totals(sum(o.gross), sum(o.discount), sum(o.net),
      count(o.id), sum(o.units)::bigint, count(distinct o.user_id)) as metrics
    from grids g left join paid_orders o on o.period = g.period
      and o.sales_date >= g.bucket_from and o.sales_date < g.bucket_to
    group by g.period, g.position
  ), trend_categories as (
    select g.period, g.position, c.key, public.admin_sales_totals(sum(i.gross), sum(i.discount), sum(i.net),
      count(distinct i.order_id), count(i.id), count(distinct i.user_id)) as metrics
    from grids g cross join category_labels c
    left join sold_items i on i.period = g.period and i.category = c.key
      and i.sales_date >= g.bucket_from and i.sales_date < g.bucket_to
    group by g.period, g.position, c.key
  ), trend_points as (
    select g.period, g.position, jsonb_build_object(
      'date', g.bucket_from, 'total', t.metrics,
      'categories', (select jsonb_object_agg(c.key, c.metrics) from trend_categories c
        where c.period = g.period and c.position = g.position)
    ) as point
    from grids g join trend_totals t on t.period = g.period and t.position = g.position
  ), dimensions as (
    select i.*, d.dimension, d.key, d.label, d.session_bucket
    from sold_items i
    cross join lateral (
      select 'categories'::text as dimension, i.category as key, c.label, null::integer as session_bucket
      from category_labels c where c.key = i.category
      union all
      select 'private_tiers', coalesce(i.tier_key, 'unknown'), coalesce(i.tier, 'Tidak diketahui'), null
        where i.category = 'private'
      union all
      select 'private_sessions', coalesce(i.sessions::text, 'unknown'),
        case when i.sessions is null then 'Tidak diketahui' else i.sessions::text || ' sesi' end, i.sessions
        where i.category = 'private'
      union all
      select 'private_purchase_types', coalesce(i.purchase_type, 'unknown'),
        case i.purchase_type when 'new_enrollment' then 'Pembelian baru'
          when 'top_up' then 'Top-up' else 'Tidak diketahui' end, null
        where i.category = 'private'
      union all
      select 'intensive_subtypes', i.kind,
        case i.kind when 'intensive_mentoring_package' then 'Paket'
          when 'intensive_mentoring_add_on' then 'Add-on'
          when 'intensive_mentoring_bundle' then 'Bundle'
          when 'intensive_mentoring_custom_offer' then 'Penawaran Internasional'
          else 'Lainnya' end, null
        where i.category = 'intensive'
    ) d where i.period = 1
  ), dimension_metrics as (
    select dimension, key, max(label) as label, max(session_bucket) as sessions,
      sum(i.sessions) as purchased_sessions,
      sum(gross) as gross, sum(discount) as discount, sum(net) as net,
      count(distinct order_id) as orders, count(*) as units, count(distinct user_id) as buyers
    from dimensions i group by dimension, key
  ), breakdowns as (
    select dimension, key, net, public.admin_sales_totals(gross, discount, net, orders, units, buyers)
      || jsonb_build_object('key', key, 'label', label, 'sessions', sessions,
        'purchased_sessions', purchased_sessions,
        'share', case when coalesce((select sum(o.net) from paid_orders o where o.period = 1), 0) = 0
          then 0 else 100.0 * net / (select sum(o.net) from paid_orders o where o.period = 1) end) as metrics
    from dimension_metrics
  ), product_totals as materialized (
    select md5(jsonb_build_array(i.commerce_item_id, i.kind, i.name, i.slug_snapshot,
        i.tier, i.sessions, i.purchase_type, i.competition_scope, i.sessions_per_month)::text) as key,
      i.commerce_item_id, i.name, i.kind, i.category, i.tier, i.sessions, i.purchase_type,
      i.competition_scope, i.sessions_per_month, sum(i.gross) as gross,
      sum(i.discount) as discount, sum(i.net) as net, count(*) as units,
      count(distinct i.order_id) as orders
    from sold_items i where i.period = 1
    group by i.commerce_item_id, i.kind, i.name, i.slug_snapshot, i.category,
      i.tier, i.sessions, i.purchase_type, i.competition_scope, i.sessions_per_month
  ), category_product_ranks as (
    select key,
      row_number() over(partition by category order by net desc, units desc, key) as revenue_rank,
      row_number() over(partition by category order by units desc, net desc, key) as unit_rank
    from product_totals
  ), product_metrics as (
    -- Keep both rankings and each business category's Top 10 accurate, including
    -- low-priced high-volume products. At most 280 aggregates, never raw history.
    select p.* from product_totals p where p.key in (
      (select key from product_totals order by net desc, units desc, key limit 100)
      union
      (select key from product_totals order by units desc, net desc, key limit 100)
      union
      select key from category_product_ranks where revenue_rank <= 10 or unit_rank <= 10
    )
  ), payment_metrics as (
    select coalesce(payment_method, 'unknown') as key,
      coalesce(payment_method, 'Tidak diketahui') as label,
      public.admin_sales_totals(sum(gross), sum(discount), sum(net), count(*),
        sum(units)::bigint, count(distinct user_id)) as metrics
    from paid_orders where period = 1 group by payment_method
  ), lifecycle_orders as (
    -- This is current lifecycle composition of orders CREATED during the range,
    -- deliberately distinct from the payment-time revenue/paid-order totals.
    select o.id, o.status, case when v_scope = 'all' then o.total_amount else sum(i.net) end as amount
    from public.orders o left join public.admin_sales_item_facts i on i.order_id = o.id
      and (v_scope = 'all' or i.category = v_scope)
    where o.created_at >= v_start and o.created_at < v_end
      and (v_scope = 'all' or i.id is not null)
    group by o.id, o.status, o.total_amount
  ), lifecycle_metrics as (
    select s.key, count(o.id) as orders, coalesce(sum(o.amount), 0) as amount
    from (values ('paid'), ('pending_payment'), ('payment_failed'), ('expired'), ('cancelled')) s(key)
    left join lifecycle_orders o on o.status = s.key group by s.key
  ), discount_metrics as (
    select discount_code as code, count(*) as orders, sum(gross) as gross,
      sum(discount) as discount, sum(net) as net, avg(discount) as average_discount
    from paid_orders where period = 1 and discount_code is not null
    group by discount_code order by net desc, orders desc, code limit 100
  ), selected_buyers as (
    select distinct user_id from paid_orders where period = 1
  ), buyer_history as (
    -- Repeat means at least TWO distinct lifetime paid orders before the range's
    -- exclusive end, irrespective of scope. A multi-item order is one purchase.
    select b.user_id, count(o.id) >= 2 as is_repeat
    from selected_buyers b join public.admin_sales_order_facts o on o.user_id = b.user_id
      and o.status = 'paid' and o.recognized_at < v_end
    group by b.user_id
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', v_to,
      'previous_from', v_previous_from, 'previous_to', v_previous_to, 'granularity', v_granularity),
    'totals', coalesce((select metrics from period_totals where period = 1),
      public.admin_sales_totals(0, 0, 0, 0, 0, 0)),
    'previous', case when v_compare then coalesce((select metrics from period_totals where period = 0),
      public.admin_sales_totals(0, 0, 0, 0, 0, 0)) else null end,
    'trend', coalesce((select jsonb_agg(point order by position) from trend_points where period = 1), '[]'::jsonb),
    'previous_trend', coalesce((select jsonb_agg(point order by position) from trend_points where period = 0), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(metrics order by net desc, key) from breakdowns where dimension = 'categories'), '[]'::jsonb),
    'private_tiers', coalesce((select jsonb_agg(metrics order by net desc, key) from breakdowns where dimension = 'private_tiers'), '[]'::jsonb),
    'private_sessions', coalesce((select jsonb_agg(metrics order by (metrics->>'sessions')::integer nulls last, key)
      from breakdowns where dimension = 'private_sessions'), '[]'::jsonb),
    'private_purchase_types', coalesce((select jsonb_agg(metrics order by net desc, key)
      from breakdowns where dimension = 'private_purchase_types'), '[]'::jsonb),
    'intensive_subtypes', coalesce((select jsonb_agg(metrics order by net desc, key)
      from breakdowns where dimension = 'intensive_subtypes'), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(to_jsonb(p) order by p.net desc, p.units desc, p.key) from product_metrics p), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(metrics || jsonb_build_object('key', key, 'label', label)
      order by (metrics->>'net')::numeric desc, key) from payment_metrics), '[]'::jsonb),
    'statuses', coalesce((select jsonb_agg(to_jsonb(s) order by s.key) from lifecycle_metrics s), '[]'::jsonb),
    'discounts', coalesce((select jsonb_agg(to_jsonb(d) order by d.net desc, d.orders desc, d.code) from discount_metrics d), '[]'::jsonb),
    'discount_orders', (select count(*) from paid_orders where period = 1 and discount > 0),
    'customers', (select jsonb_build_object(
      'first_time', count(*) filter (where not is_repeat), 'repeat', count(*) filter (where is_repeat),
      'repeat_share', case when count(*) = 0 then 0 else 100.0 * count(*) filter (where is_repeat) / count(*) end
    ) from buyer_history),
    'legacy_paid_orders', (select count(*) from paid_orders where period = 1 and legacy_paid)
  ) into v_result;
  return v_result;
end;
$$;

-- One STABLE RPC keeps summary, count, rows and item cap on one MVCC snapshot.
-- Limits are explicit, checked before row JSON is materialized, never truncation.
create function public.get_admin_sales_export(
  p_from date default null, p_to date default null, p_scope text default 'all',
  p_compare boolean default true, p_query text default '', p_status text default '',
  p_payment text default '', p_sort text default 'created', p_direction text default 'desc',
  p_max_orders integer default 50000, p_max_items integer default 100000
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_max_orders integer := coalesce(p_max_orders, 50000);
  v_max_items integer := coalesce(p_max_items, 100000);
  v_orders bigint;
  v_items bigint;
  v_page jsonb;
begin
  if public.is_admin() is distinct from true then raise exception 'Admin required' using errcode = '42501'; end if;
  if v_max_orders not between 1 and 50000 or v_max_items not between 1 and 100000 then
    raise exception 'Invalid export limit' using errcode = '22023';
  end if;
  select count(*), coalesce(sum((select count(*) from public.order_items oi where oi.order_id = o.id)), 0)
    into v_orders, v_items
  from public.admin_sales_filtered_orders(p_from, p_to, p_scope, p_query, p_status, p_payment) o;
  if v_orders > v_max_orders or v_items > v_max_items then
    raise exception 'Export exceeds the order or item limit; select a narrower range'
      using errcode = '54000';
  end if;
  v_page := public.list_admin_sales_transactions(p_from, p_to, p_scope, p_query,
    p_status, p_payment, p_sort, p_direction, greatest(v_orders, 1)::integer, 0);
  return jsonb_build_object(
    'report', public.get_admin_sales_report(p_from, p_to, p_scope, p_compare, 'auto'),
    'rows', v_page->'rows', 'total_count', v_orders, 'item_count', v_items
  );
end;
$$;

revoke all on function public.get_admin_sales_report(date, date, text, boolean, text),
  public.list_admin_sales_transactions(date, date, text, text, text, text, text, text, integer, integer),
  public.get_admin_sales_export(date, date, text, boolean, text, text, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.get_admin_sales_report(date, date, text, boolean, text),
  public.list_admin_sales_transactions(date, date, text, text, text, text, text, text, integer, integer),
  public.get_admin_sales_export(date, date, text, boolean, text, text, text, text, text, integer, integer)
  to authenticated;
