-- Flexible comparison periods extend the established sales snapshot read models.
-- Historical payment recognition, financial totals and category rules stay in
-- the existing STABLE functions; no historical migration or data is rewritten.
create function public.get_admin_sales_report_v2(
  p_from date default null, p_to date default null, p_scope text default 'all',
  p_compare_mode text default 'none', p_compare_from date default null,
  p_compare_to date default null, p_granularity text default 'auto'
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_to date := coalesce(p_to, (now() at time zone 'Asia/Jakarta')::date);
  v_mode text := lower(btrim(coalesce(p_compare_mode, 'none')));
  v_previous_from date;
  v_previous_to date;
  v_report jsonb;
  v_comparison jsonb;
begin
  if public.is_admin() is distinct from true then raise exception 'Admin required' using errcode = '42501'; end if;
  if v_mode not in ('none', 'previous', 'custom')
    or v_to not between date '0001-01-01' and date '9999-12-30'
    or (p_from is not null and (p_from < date '0001-01-01' or p_from > v_to))
    or (p_from is null and v_mode <> 'none') then
    raise exception 'Invalid report comparison or primary period' using errcode = '22023';
  end if;
  if p_from is not null
    and (extract(year from v_to) - extract(year from p_from)) * 12
      + extract(month from v_to) - extract(month from p_from) >= 600 then
    raise exception 'Reporting range exceeds 600 monthly periods' using errcode = '22023';
  end if;
  if v_mode <> 'custom' and (p_compare_from is not null or p_compare_to is not null) then
    raise exception 'Comparison dates require custom mode' using errcode = '22023';
  end if;
  if v_mode = 'custom' then
    if p_compare_from is null or p_compare_to is null
      or p_compare_from not between date '0001-01-01' and date '9999-12-30'
      or p_compare_to not between date '0001-01-01' and date '9999-12-30'
      or p_compare_from > p_compare_to then
      raise exception 'Invalid custom comparison period' using errcode = '22023';
    end if;
    if (extract(year from p_compare_to) - extract(year from p_compare_from)) * 12
      + extract(month from p_compare_to) - extract(month from p_compare_from) >= 600 then
      raise exception 'Comparison range exceeds 600 monthly periods' using errcode = '22023';
    end if;
    v_previous_from := p_compare_from;
    v_previous_to := p_compare_to;
  elsif v_mode = 'previous' then
    -- Inclusive equal-duration dates match the existing reporting RPC exactly.
    v_previous_from := p_from - (v_to - p_from + 1);
    v_previous_to := p_from - 1;
    if v_previous_from < date '0001-01-01' then
      raise exception 'Previous comparison starts before the supported date range' using errcode = '22023';
    end if;
  end if;

  v_report := public.get_admin_sales_report(p_from, v_to, p_scope, v_mode = 'previous', p_granularity);
  if v_mode = 'custom' then
    -- Evaluate arbitrary/overlapping durations independently on the same snapshot.
    -- Each comparison point keeps its actual date and its own safe granularity.
    v_comparison := public.get_admin_sales_report(p_compare_from, p_compare_to, p_scope, false, p_granularity);
    v_report := v_report || jsonb_build_object(
      'previous', v_comparison->'totals', 'previous_trend', v_comparison->'trend'
    );
  end if;
  return v_report || jsonb_build_object('range', (v_report->'range') || jsonb_build_object(
    'previous_from', v_previous_from, 'previous_to', v_previous_to,
    'compare_mode', v_mode, 'comparison_aligned', v_mode = 'previous'
  ));
end;
$$;

-- Export counts, primary transaction rows and both summaries share one STABLE
-- MVCC snapshot. Comparison periods never enter transaction selection or caps.
create function public.get_admin_sales_export_v2(
  p_from date default null, p_to date default null, p_scope text default 'all',
  p_compare_mode text default 'none', p_compare_from date default null,
  p_compare_to date default null, p_query text default '', p_status text default '',
  p_payment text default '', p_sort text default 'created', p_direction text default 'desc',
  p_max_orders integer default 50000, p_max_items integer default 100000
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_to date := coalesce(p_to, (now() at time zone 'Asia/Jakarta')::date);
  v_max_orders integer := coalesce(p_max_orders, 50000);
  v_max_items integer := coalesce(p_max_items, 100000);
  v_orders bigint;
  v_items bigint;
  v_page jsonb;
  v_report jsonb;
begin
  if public.is_admin() is distinct from true then raise exception 'Admin required' using errcode = '42501'; end if;
  if v_max_orders not between 1 and 50000 or v_max_items not between 1 and 100000 then
    raise exception 'Invalid export limit' using errcode = '22023';
  end if;
  -- Validate before the shared selector casts dates to timestamps. PostgreSQL's
  -- date type accepts extremes beyond the supported reporting/timestamp range.
  if v_to not between date '0001-01-01' and date '9999-12-30'
    or (p_from is not null and (p_from < date '0001-01-01' or p_from > v_to)) then
    raise exception 'Invalid export period' using errcode = '22023';
  end if;
  if p_from is not null
    and (extract(year from v_to) - extract(year from p_from)) * 12
      + extract(month from v_to) - extract(month from p_from) >= 600 then
    raise exception 'Export range exceeds 600 monthly periods' using errcode = '22023';
  end if;
  select count(*), coalesce(sum((select count(*) from public.order_items oi where oi.order_id = o.id)), 0)
    into v_orders, v_items
  from public.admin_sales_filtered_orders(p_from, v_to, p_scope, p_query, p_status, p_payment) o;
  if v_orders > v_max_orders or v_items > v_max_items then
    raise exception 'Export exceeds the order or item limit; select a narrower range'
      using errcode = '54000';
  end if;
  v_report := public.get_admin_sales_report_v2(p_from, v_to, p_scope,
    p_compare_mode, p_compare_from, p_compare_to, 'auto');
  v_page := public.list_admin_sales_transactions(p_from, v_to, p_scope, p_query,
    p_status, p_payment, p_sort, p_direction, greatest(v_orders, 1)::integer, 0);
  return jsonb_build_object(
    'report', v_report, 'rows', v_page->'rows', 'total_count', v_orders, 'item_count', v_items
  );
end;
$$;

revoke all on function public.get_admin_sales_report_v2(date, date, text, text, date, date, text),
  public.get_admin_sales_export_v2(date, date, text, text, date, date, text, text, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.get_admin_sales_report_v2(date, date, text, text, date, date, text),
  public.get_admin_sales_export_v2(date, date, text, text, date, date, text, text, text, text, text, integer, integer)
  to authenticated;
