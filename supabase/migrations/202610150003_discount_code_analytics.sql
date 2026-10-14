-- Admin-only discount reporting. No checkout/payment/redemption behavior changes.
-- Existing records retain NULL attribution; these labels describe CURRENT code
-- metadata, not a reconstructed campaign at the time of a historic purchase.
alter table public.commerce_discount_codes
  add column campaign_name text,
  add column collaboration_label text,
  add column trusted_partner_id uuid references public.trusted_partners(id) on delete set null,
  add constraint commerce_discount_campaign_length check (campaign_name is null or char_length(campaign_name) <= 200),
  add constraint commerce_discount_collaboration_length check (collaboration_label is null or char_length(collaboration_label) <= 200);

comment on column public.commerce_discount_codes.trusted_partner_id is 'Optional internal attribution to a confirmed Trusted Partner, independent of customer institution.';
comment on column public.commerce_discount_codes.campaign_name is 'Optional current internal campaign metadata; historic unknown values remain NULL.';
comment on column public.commerce_discount_codes.collaboration_label is 'Optional ad-hoc internal collaboration label or fallback if a linked Trusted Partner is deleted.';

create index commerce_discount_campaign_idx on public.commerce_discount_codes (campaign_name, id) where campaign_name is not null;
create index commerce_discount_partner_idx on public.commerce_discount_codes (trusted_partner_id, id) where trusted_partner_id is not null;
create index commerce_discount_paid_reporting_idx on public.commerce_discount_redemptions (discount_code_id, order_id, user_id) where status = 'redeemed';

-- The original save RPC and its signature remain intact for existing clients.
-- This wrapper saves scope/category/product mappings and metadata atomically.
create function public.admin_save_discount_code_with_metadata(
  p_discount_code_id uuid, p_code text, p_description text, p_discount_type text,
  p_discount_value bigint, p_minimum_subtotal_amount bigint, p_starts_at timestamptz,
  p_ends_at timestamptz, p_max_redemptions integer, p_scope text, p_is_active boolean,
  p_categories text[], p_product_ids uuid[], p_campaign_name text,
  p_collaboration_label text, p_trusted_partner_id uuid
)
returns public.commerce_discount_codes language plpgsql security definer set search_path = '' as $$
declare
  v_code public.commerce_discount_codes;
  v_campaign text := nullif(btrim(p_campaign_name), '');
  v_collaboration text := nullif(btrim(p_collaboration_label), '');
begin
  if public.is_admin() is distinct from true then raise exception 'Admin required' using errcode = '42501'; end if;
  if char_length(v_campaign) > 200 or char_length(v_collaboration) > 200
    or coalesce(v_campaign, '') ~ '[[:cntrl:]]' or coalesce(v_collaboration, '') ~ '[[:cntrl:]]' then
    raise exception 'Invalid campaign or collaboration label' using errcode = '22023';
  end if;
  if p_trusted_partner_id is not null then
    -- Hold the relationship through the atomic save; inactive historical links
    -- remain valid and are explicitly identified by the editor.
    perform 1 from public.trusted_partners where id = p_trusted_partner_id for key share;
    if not found then raise exception 'Trusted Partner not found' using errcode = '22023'; end if;
  end if;
  select * into v_code from public.admin_save_discount_code(
    p_discount_code_id, p_code, p_description, p_discount_type, p_discount_value,
    p_minimum_subtotal_amount, p_starts_at, p_ends_at, p_max_redemptions,
    p_scope, p_is_active, p_categories, p_product_ids
  );
  update public.commerce_discount_codes set campaign_name = v_campaign,
    collaboration_label = v_collaboration, trusted_partner_id = p_trusted_partner_id
  where id = v_code.id returning * into v_code;
  return v_code;
end;
$$;

-- One row per paid ORDER, including the shared immutable monetary snapshots and
-- shared paid-time fallback. Retry attempts, items and profile joins cannot
-- multiply financial totals. A redeemed reservation alone is insufficient.
create view public.admin_discount_order_facts as
select o.id as order_id, o.user_id, r.discount_code_id as code_id,
  coalesce(o.discount_code, nullif(btrim(r.code_snapshot), ''), dc.code) as code,
  dc.campaign_name as campaign,
  coalesce(nullif(btrim(partner.organization_name), ''), nullif(btrim(dc.collaboration_label), '')) as partner,
  o.invoice_number as invoice, o.customer, o.email,
  nullif(btrim(institution.name), '') as institution,
  -- Onboarding records either a master relationship OR an ad-hoc response.
  coalesce(nullif(btrim(referral.name), ''), nullif(btrim(mp.referral_other_text), '')) as referral,
  o.recognized_at as purchased_at, o.legacy_paid, o.gross, o.discount, o.net,
  coalesce(categories.category_values, '{}'::text[]) as categories,
  coalesce(products.product_values, '[]'::jsonb) as products
from public.admin_sales_order_facts o
join lateral (
  select redemption.* from public.commerce_discount_redemptions redemption
  where redemption.order_id = o.id and redemption.user_id = o.user_id and redemption.status = 'redeemed'
  order by redemption.redeemed_at desc nulls last, redemption.created_at desc, redemption.id desc limit 1
) r on true
join public.commerce_discount_codes dc on dc.id = r.discount_code_id
left join public.trusted_partners partner on partner.id = dc.trusted_partner_id
left join public.mentee_profiles mp on mp.user_id = o.user_id
left join public.institutions institution on institution.id = mp.institution_id
left join public.referral_sources referral on referral.id = mp.referral_source_id
left join lateral (
  select array_agg(c.category order by c.category) as category_values
  from public.commerce_discount_code_categories c where c.discount_code_id = dc.id
) categories on true
left join lateral (
  select jsonb_agg(jsonb_build_object('id', oi.id, 'name', oi.name_snapshot, 'kind', oi.item_kind_snapshot)
    order by oi.created_at, oi.id) as product_values from public.order_items oi where oi.order_id = o.id
) products on true
where o.status = 'paid';

-- Shared by report, detail and export. The category filter selects the code's
-- CURRENT applicability, retaining complete order totals and purchased items.
create function public.admin_discount_filtered_orders(
  p_from date, p_to date, p_code_id uuid, p_campaign text, p_partner text, p_category text
)
returns setof public.admin_discount_order_facts
language plpgsql stable security definer set search_path = '' as $$
declare
  v_to date := coalesce(p_to, (now() at time zone 'Asia/Jakarta')::date);
  v_campaign text := lower(btrim(coalesce(p_campaign, '')));
  v_partner text := lower(btrim(coalesce(p_partner, '')));
  v_category text := coalesce(p_category, 'all');
begin
  if public.is_admin() is distinct from true then raise exception 'Admin required' using errcode = '42501'; end if;
  if v_to not between date '0001-01-01' and date '9999-12-30'
    or (p_from is not null and (p_from < date '0001-01-01' or p_from > v_to))
    or char_length(v_campaign) > 200 or char_length(v_partner) > 200
    or v_campaign ~ '[[:cntrl:]]' or v_partner ~ '[[:cntrl:]]'
    or v_category not in ('all', 'digital_products', 'private_mentoring', 'intensive_mentoring') then
    raise exception 'Invalid discount analytics filters' using errcode = '22023';
  end if;
  return query select o.* from public.admin_discount_order_facts o
  where (p_from is null or o.purchased_at >= p_from::timestamp at time zone 'Asia/Jakarta')
    and o.purchased_at < (v_to + 1)::timestamp at time zone 'Asia/Jakarta'
    and (p_code_id is null or o.code_id = p_code_id)
    and (v_campaign = '' or strpos(lower(coalesce(o.campaign, '')), v_campaign) > 0)
    and (v_partner = '' or strpos(lower(coalesce(o.partner, '')), v_partner) > 0)
    and (v_category = 'all' or v_category = any(o.categories));
end;
$$;

create function public.get_admin_discount_report(
  p_from date default null, p_to date default null, p_code_id uuid default null,
  p_campaign text default '', p_partner text default '', p_category text default 'all',
  p_limit integer default 25, p_offset integer default 0
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  if public.is_admin() is distinct from true then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0 or p_offset > 1000000 then
    raise exception 'Invalid analytics page' using errcode = '22023';
  end if;
  -- The summary reads facts even when no codes/paid orders exist, preserving
  -- filter validation without an extra pass over the reporting view.
  with facts as materialized (
    select * from public.admin_discount_filtered_orders(p_from, p_to, p_code_id, p_campaign, p_partner, p_category)
  ), period as (
    select coalesce(p_from, (min(purchased_at) at time zone 'Asia/Jakarta')::date,
      coalesce(p_to, (now() at time zone 'Asia/Jakarta')::date)) as first_date,
      coalesce(p_to, (now() at time zone 'Asia/Jakarta')::date) as last_date from facts
  ), grain as (
    select case when last_date - first_date <= 62 then 'day'
      when last_date - first_date <= 366 then 'week' else 'month' end as value from period
  ), matching_codes as (
    select dc.id as code_id, dc.code, dc.description, dc.campaign_name as campaign,
      coalesce(nullif(btrim(tp.organization_name), ''), nullif(btrim(dc.collaboration_label), '')) as partner,
      dc.trusted_partner_id, dc.scope, coalesce(cat.category_values, '{}'::text[]) as categories
    from public.commerce_discount_codes dc
    left join public.trusted_partners tp on tp.id = dc.trusted_partner_id
    left join lateral (select array_agg(c.category order by c.category) as category_values
      from public.commerce_discount_code_categories c where c.discount_code_id = dc.id) cat on true
    where (p_code_id is null or dc.id = p_code_id)
      and (btrim(coalesce(p_campaign, '')) = '' or strpos(lower(coalesce(dc.campaign_name, '')), lower(btrim(p_campaign))) > 0)
      and (btrim(coalesce(p_partner, '')) = '' or strpos(lower(coalesce(nullif(btrim(tp.organization_name), ''), nullif(btrim(dc.collaboration_label), ''), '')), lower(btrim(p_partner))) > 0)
      and (coalesce(p_category, 'all') = 'all' or p_category = any(cat.category_values))
  ), performance as (
    select c.*, count(f.order_id) as redemptions, count(distinct f.user_id) as customers,
      coalesce(sum(f.discount), 0) as discount, coalesce(sum(f.gross), 0) as gross, coalesce(sum(f.net), 0) as net,
      count(f.order_id) filter (where f.legacy_paid) as legacy_paid,
      min(f.purchased_at) as first_at, max(f.purchased_at) as latest_at
    from matching_codes c left join facts f on f.code_id = c.code_id
    group by c.code_id, c.code, c.description, c.campaign, c.partner, c.trusted_partner_id, c.scope, c.categories
  ), paged as (
    select * from performance order by redemptions desc, net desc, code, code_id limit p_limit offset p_offset
  ), trend as (
    select date_trunc((select value from grain), purchased_at at time zone 'Asia/Jakarta')::date as date,
      count(*) as redemptions, count(distinct user_id) as customers,
      sum(discount) as discount, sum(gross) as gross, sum(net) as net from facts group by 1
  ), top_codes as (
    select code_id, code, redemptions from performance where redemptions > 0
      order by redemptions desc, net desc, code, code_id limit 5
  )
  select jsonb_build_object(
    'summary', (select jsonb_build_object('redemptions', count(*), 'customers', count(distinct user_id),
      'discount', coalesce(sum(discount), 0), 'gross', coalesce(sum(gross), 0), 'net', coalesce(sum(net), 0),
      'legacy_paid', count(*) filter (where legacy_paid)) from facts),
    'granularity', (select value from grain),
    'trend', coalesce((select jsonb_agg(to_jsonb(t) order by t.date) from trend t), '[]'::jsonb),
    'most_used', coalesce((select jsonb_agg(to_jsonb(t) order by t.redemptions desc, t.code, t.code_id) from top_codes t), '[]'::jsonb),
    'rows', coalesce((select jsonb_agg(to_jsonb(p) order by p.redemptions desc, p.net desc, p.code, p.code_id) from paged p), '[]'::jsonb),
    'total_count', (select count(*) from performance)
  ) into v_result;
  return v_result;
end;
$$;

create function public.list_admin_discount_usage(
  p_from date default null, p_to date default null, p_code_id uuid default null,
  p_campaign text default '', p_partner text default '', p_category text default 'all',
  p_limit integer default 25, p_offset integer default 0
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if public.is_admin() is distinct from true then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0 or p_offset > 1000000 then
    raise exception 'Invalid usage page' using errcode = '22023';
  end if;
  with facts as materialized (
    select * from public.admin_discount_filtered_orders(p_from, p_to, p_code_id, p_campaign, p_partner, p_category)
  ), paged as (
    select * from facts order by purchased_at desc, order_id desc limit p_limit offset p_offset
  ) select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(p) order by p.purchased_at desc, p.order_id desc) from paged p), '[]'::jsonb),
    'total_count', (select count(*) from facts)
  ) into v_result;
  return v_result;
end;
$$;

-- Single MVCC statement returns the entire matching dataset and its totals.
-- Exports cannot silently inherit a browser page limit or PostgREST row cap.
create function public.get_admin_discount_export(
  p_from date default null, p_to date default null, p_code_id uuid default null,
  p_campaign text default '', p_partner text default '', p_category text default 'all'
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if public.is_admin() is distinct from true then raise exception 'Admin required' using errcode = '42501'; end if;
  with facts as materialized (
    select * from public.admin_discount_filtered_orders(p_from, p_to, p_code_id, p_campaign, p_partner, p_category)
  ), totals as (
    select count(*) as orders, coalesce(sum(jsonb_array_length(products)), 0) as items,
      jsonb_build_object('redemptions', count(*), 'customers', count(distinct user_id),
        'discount', coalesce(sum(discount), 0), 'gross', coalesce(sum(gross), 0), 'net', coalesce(sum(net), 0),
        'legacy_paid', count(*) filter (where legacy_paid)) as summary from facts
  ) select jsonb_build_object('total_count', t.orders, 'item_count', t.items, 'summary', t.summary,
    'rows', case when t.orders <= 25000 and t.items <= 100000 then
      coalesce((select jsonb_agg(to_jsonb(f) order by f.purchased_at desc, f.order_id desc) from facts f), '[]'::jsonb)
      else null end) into v_result from totals t;
  if (v_result->>'total_count')::bigint > 25000 or (v_result->>'item_count')::bigint > 100000 then
    raise exception 'Discount export exceeds 25000 orders or 100000 items' using errcode = '54000';
  end if;
  return v_result;
end;
$$;

revoke all on public.admin_discount_order_facts from public, anon, authenticated;
revoke all on function public.admin_discount_filtered_orders(date, date, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_save_discount_code_with_metadata(uuid, text, text, text, bigint, bigint, timestamptz, timestamptz, integer, text, boolean, text[], uuid[], text, text, uuid),
  public.get_admin_discount_report(date, date, uuid, text, text, text, integer, integer),
  public.list_admin_discount_usage(date, date, uuid, text, text, text, integer, integer),
  public.get_admin_discount_export(date, date, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_save_discount_code_with_metadata(uuid, text, text, text, bigint, bigint, timestamptz, timestamptz, integer, text, boolean, text[], uuid[], text, text, uuid),
  public.get_admin_discount_report(date, date, uuid, text, text, text, integer, integer),
  public.list_admin_discount_usage(date, date, uuid, text, text, text, integer, integer),
  public.get_admin_discount_export(date, date, uuid, text, text, text) to authenticated;
