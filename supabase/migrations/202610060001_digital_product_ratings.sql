-- Private verified-owner ratings for Digital Products.
-- Review rows are never publicly selectable; public callers receive only an aggregate RPC.

alter table public.digital_products
  add column if not exists show_rating boolean not null default false;

create table public.digital_product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.digital_products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or (comment = btrim(comment) and char_length(comment) <= 2000)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index digital_product_reviews_product_rating
  on public.digital_product_reviews (product_id, rating);
create index digital_product_reviews_product_updated
  on public.digital_product_reviews (product_id, updated_at desc, id);

create trigger digital_product_reviews_touch_updated_at
before update on public.digital_product_reviews
for each row execute function public.touch_updated_at();

alter table public.digital_product_reviews enable row level security;

create policy digital_product_reviews_owner_or_admin_read
on public.digital_product_reviews for select to authenticated
using (user_id = auth.uid() or public.is_admin());

revoke all on public.digital_product_reviews from anon, authenticated;
grant select on public.digital_product_reviews to authenticated;
grant all on public.digital_product_reviews to service_role;

grant select (show_rating) on public.digital_products to anon, authenticated;
grant update (show_rating) on public.digital_products to authenticated;

create or replace function public.get_my_digital_product_review(p_product_id uuid)
returns table (
  id uuid,
  product_id uuid,
  user_id uuid,
  rating smallint,
  comment text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.product_id, r.user_id, r.rating, r.comment, r.created_at, r.updated_at
  from public.digital_product_reviews r
  where r.product_id = p_product_id
    and r.user_id = auth.uid()
    and exists (
      select 1
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      where o.user_id = auth.uid()
        and o.status = 'paid'
        and oi.commerce_item_id = p_product_id
        and oi.item_kind_snapshot = 'digital_product'
    )
  limit 1
$$;

create or replace function public.submit_digital_product_review(
  p_product_id uuid,
  p_rating smallint,
  p_comment text default null
)
returns public.digital_product_reviews
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_review public.digital_product_reviews;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5' using errcode = '22023';
  end if;
  if v_comment is not null and char_length(v_comment) > 2000 then
    raise exception 'Feedback is too long' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.commerce_items ci on ci.id = oi.commerce_item_id
    where o.user_id = v_uid
      and o.status = 'paid'
      and oi.commerce_item_id = p_product_id
      and oi.item_kind_snapshot = 'digital_product'
      and ci.item_kind = 'digital_product'
  ) then
    raise exception 'Paid Digital Product ownership required' using errcode = '42501';
  end if;

  insert into public.digital_product_reviews (product_id, user_id, rating, comment)
  values (p_product_id, v_uid, p_rating, v_comment)
  on conflict (product_id, user_id) do update set
    rating = excluded.rating,
    comment = excluded.comment,
    updated_at = now()
  returning * into v_review;

  return v_review;
end;
$$;

create or replace function public.list_public_digital_product_ratings()
returns table (
  product_id uuid,
  average_rating numeric,
  rating_count bigint
)
language sql stable security definer set search_path = '' as $$
  select r.product_id,
    round(avg(r.rating)::numeric, 1),
    count(*)::bigint
  from public.digital_product_reviews r
  join public.digital_products p on p.id = r.product_id
  where p.is_published
    and p.show_rating
  group by r.product_id
  having count(*) > 0
$$;

create or replace function public.list_admin_digital_product_reviews(p_product_id uuid)
returns table (
  id uuid,
  product_id uuid,
  user_id uuid,
  customer_name text,
  rating smallint,
  comment text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select r.id, r.product_id, r.user_id,
    coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.username, 'Customer'),
    r.rating, r.comment, r.created_at, r.updated_at
  from public.digital_product_reviews r
  left join public.profiles p on p.id = r.user_id
  where r.product_id = p_product_id
  order by r.updated_at desc, r.id desc;
end;
$$;

create or replace function public.set_digital_product_rating_visibility(
  p_product_id uuid,
  p_show_rating boolean
)
returns public.digital_products
language plpgsql security definer set search_path = '' as $$
declare
  v_product public.digital_products;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  update public.digital_products
  set show_rating = coalesce(p_show_rating, false)
  where id = p_product_id
  returning * into v_product;
  if not found then
    raise exception 'Digital Product not found' using errcode = '22023';
  end if;
  return v_product;
end;
$$;

revoke all on function public.get_my_digital_product_review(uuid),
  public.submit_digital_product_review(uuid, smallint, text),
  public.list_public_digital_product_ratings(),
  public.list_admin_digital_product_reviews(uuid),
  public.set_digital_product_rating_visibility(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.get_my_digital_product_review(uuid),
  public.submit_digital_product_review(uuid, smallint, text)
  to authenticated;
grant execute on function public.list_public_digital_product_ratings() to anon, authenticated;
grant execute on function public.list_admin_digital_product_reviews(uuid),
  public.set_digital_product_rating_visibility(uuid, boolean)
  to authenticated;
