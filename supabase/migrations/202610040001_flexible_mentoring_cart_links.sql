-- Flexible mentoring preferences and cart-link-only Private Mentoring offers.
-- Forward-only: public package masters remain limited to the official package catalog.

alter table public.private_mentoring_enrollments
  add column if not exists competition_names text[] not null default '{}'::text[];
alter table public.intensive_mentoring_engagements
  add column if not exists competition_names text[] not null default '{}'::text[];

update public.private_mentoring_enrollments
set competition_names = array[btrim(competition_name)]
where coalesce(array_length(competition_names, 1), 0) = 0
  and nullif(btrim(coalesce(competition_name, '')), '') is not null;
update public.intensive_mentoring_engagements
set competition_names = array[btrim(competition_name)]
where coalesce(array_length(competition_names, 1), 0) = 0
  and nullif(btrim(coalesce(competition_name, '')), '') is not null;

alter table public.private_mentoring_sessions
  add column if not exists requested_focus_custom_text text,
  add column if not exists final_focus_custom_text text,
  add column if not exists supporting_materials text[] not null default '{}'::text[];
alter table public.intensive_mentoring_sessions
  add column if not exists requested_focus_custom_text text,
  add column if not exists final_focus_custom_text text,
  add column if not exists mentor_scope_notes text,
  add column if not exists supporting_materials text[] not null default '{}'::text[];

-- Older constraints required non-empty focus/topic values. Optional preferences are now valid.
do $$
declare r record;
begin
  for r in
    select conrelid::regclass as relation_name, conname
    from pg_constraint
    where conrelid in ('public.private_mentoring_sessions'::regclass, 'public.intensive_mentoring_sessions'::regclass)
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) ilike '%char_length%btrim%resolved_topic%'
        or pg_get_constraintdef(oid) ilike '%char_length%btrim%mentee_topic_request%'
        or (pg_get_constraintdef(oid) ilike '%scheduled%' and pg_get_constraintdef(oid) ilike '%session_focus_id%')
      )
  loop
    execute format('alter table %s drop constraint %I', r.relation_name, r.conname);
  end loop;
end $$;

alter table public.private_mentoring_sessions
  add constraint private_session_optional_text_lengths check (
    (mentee_topic_request is null or char_length(btrim(mentee_topic_request)) <= 3000)
    and (resolved_topic is null or char_length(btrim(resolved_topic)) <= 3000)
    and (requested_focus_custom_text is null or char_length(btrim(requested_focus_custom_text)) <= 300)
    and (final_focus_custom_text is null or char_length(btrim(final_focus_custom_text)) <= 300)
    and coalesce(array_length(supporting_materials, 1), 0) <= 20
  );
alter table public.intensive_mentoring_sessions
  add constraint intensive_session_optional_text_lengths check (
    (mentee_topic_request is null or char_length(btrim(mentee_topic_request)) <= 3000)
    and (resolved_topic is null or char_length(btrim(resolved_topic)) <= 3000)
    and (requested_focus_custom_text is null or char_length(btrim(requested_focus_custom_text)) <= 300)
    and (final_focus_custom_text is null or char_length(btrim(final_focus_custom_text)) <= 300)
    and coalesce(array_length(supporting_materials, 1), 0) <= 20
  );

create or replace function public.clean_text_values(p_values text[], p_limit integer, p_max_length integer)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(value order by ordinal), '{}'::text[])
  from (
    select distinct on (lower(btrim(raw_value))) btrim(raw_value) as value, ordinal
    from unnest(coalesce(p_values, '{}'::text[])) with ordinality as values_list(raw_value, ordinal)
    where nullif(btrim(raw_value), '') is not null and char_length(btrim(raw_value)) <= p_max_length
    order by lower(btrim(raw_value)), ordinal
    limit greatest(p_limit, 0)
  ) cleaned;
$$;

create or replace function public.sync_mentoring_competition_compatibility()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='UPDATE'
     and new.competition_name is distinct from old.competition_name
     and new.competition_names is not distinct from old.competition_names then
    new.competition_names := case
      when nullif(btrim(coalesce(new.competition_name,'')),'') is null then '{}'::text[]
      else array[btrim(new.competition_name)]
    end;
  end if;
  new.competition_names := public.clean_text_values(new.competition_names, 20, 300);
  if coalesce(array_length(new.competition_names,1),0)=0 and nullif(btrim(coalesce(new.competition_name,'')),'') is not null then
    new.competition_names:=array[btrim(new.competition_name)];
  end if;
  new.competition_name := new.competition_names[1];
  return new;
end;
$$;
drop trigger if exists private_competition_compatibility on public.private_mentoring_enrollments;
create trigger private_competition_compatibility before insert or update of competition_names,competition_name
on public.private_mentoring_enrollments for each row execute function public.sync_mentoring_competition_compatibility();
drop trigger if exists intensive_competition_compatibility on public.intensive_mentoring_engagements;
create trigger intensive_competition_compatibility before insert or update of competition_names,competition_name
on public.intensive_mentoring_engagements for each row execute function public.sync_mentoring_competition_compatibility();

create table public.private_mentoring_cart_link_offers (
  id uuid primary key default gen_random_uuid(),
  intended_mentee_id uuid not null references public.profiles(id),
  mode text not null check (mode in ('new_enrollment', 'top_up')),
  mentor_tier_id uuid not null references public.mentor_tiers(id),
  canonical_package_id uuid not null references public.private_mentoring_packages(id),
  target_enrollment_id uuid references public.private_mentoring_enrollments(id),
  session_count integer not null check (session_count between 1 and 20),
  current_session_count integer not null default 0 check (current_session_count >= 0),
  locked_total_amount bigint not null check (locked_total_amount between 0 and 9007199254740991),
  canonical_price_breakdown jsonb not null check (jsonb_typeof(canonical_price_breakdown) = 'array'),
  competition_category_id uuid references public.competition_categories(id),
  competition_names text[] not null default '{}'::text[],
  display_name text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check ((mode = 'top_up') = (target_enrollment_id is not null))
);
create index private_cart_link_offers_mentee on public.private_mentoring_cart_link_offers(intended_mentee_id, created_at desc);
alter table public.private_mentoring_cart_link_offers enable row level security;
revoke all on public.private_mentoring_cart_link_offers from public, anon, authenticated;
grant all on public.private_mentoring_cart_link_offers to service_role;

create table public.private_mentoring_top_ups (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id),
  offer_id uuid not null unique references public.private_mentoring_cart_link_offers(id),
  enrollment_id uuid not null references public.private_mentoring_enrollments(id),
  added_sessions integer not null check (added_sessions between 1 and 20),
  previous_session_count integer not null check (previous_session_count >= 0),
  resulting_session_count integer not null check (resulting_session_count = previous_session_count + added_sessions),
  locked_total_amount bigint not null,
  canonical_price_breakdown jsonb not null,
  fulfilled_at timestamptz not null default now()
);
alter table public.private_mentoring_top_ups enable row level security;
revoke all on public.private_mentoring_top_ups from public, anon, authenticated;
grant all on public.private_mentoring_top_ups to service_role;

create or replace function public.quote_private_mentoring_sessions(p_mentor_tier_id uuid, p_session_count integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_quote jsonb;
begin
  if not public.is_admin() and auth.role() is distinct from 'service_role' then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  if p_session_count not between 1 and 20 then raise exception 'Session count must be 1-20' using errcode = '22023'; end if;
  with recursive package_options as (
    select p.id, p.session_count, p.price_amount, row_number() over(order by p.session_count, p.price_amount, p.id)::integer as ordinal
    from public.private_mentoring_packages p
    join public.mentor_tiers t on t.id = p.mentor_tier_id
    where p.mentor_tier_id = p_mentor_tier_id and p.is_active and t.is_active and p.session_count in (1,3,5,7,10)
  ), combinations(total_sessions, total_price, package_ids, last_ordinal) as (
    select 0, 0::bigint, '{}'::uuid[], 1
    union all
    select c.total_sessions + p.session_count, c.total_price + p.price_amount, c.package_ids || p.id, p.ordinal
    from combinations c join package_options p on p.ordinal >= c.last_ordinal
    where c.total_sessions + p.session_count <= p_session_count
  ), best as (
    select * from combinations where total_sessions = p_session_count
    order by total_price, array_length(package_ids, 1), package_ids::text limit 1
  ), breakdown as (
    select jsonb_agg(jsonb_build_object(
      'packageId', p.id, 'sessionCount', p.session_count, 'unitPriceAmount', p.price_amount,
      'quantity', counts.quantity, 'subtotalAmount', p.price_amount * counts.quantity
    ) order by p.session_count desc, p.id) as items
    from best b
    cross join lateral (select package_id, count(*)::integer quantity from unnest(b.package_ids) package_id group by package_id) counts
    join package_options p on p.id = counts.package_id
  )
  select jsonb_build_object(
    'mentorTierId', p_mentor_tier_id, 'mentorTierName', t.name, 'sessionCount', p_session_count,
    'lockedTotalAmount', b.total_price, 'canonicalPackageId', b.package_ids[1],
    'breakdown', coalesce(br.items, '[]'::jsonb)
  ) into v_quote from best b cross join breakdown br join public.mentor_tiers t on t.id = p_mentor_tier_id;
  if v_quote is null then raise exception 'No exact active package combination is available for this tier' using errcode = '22023'; end if;
  return v_quote;
end;
$$;

create or replace function public.list_admin_private_cart_link_context(p_mentee_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if not exists(select 1 from public.profiles where id = p_mentee_id and role = 'mentee'::public.app_role) then
    raise exception 'Mentee not found' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'tiers', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'code', t.code) order by t.sort_order, t.name)
      from public.mentor_tiers t where t.is_active and exists(select 1 from public.private_mentoring_packages p where p.mentor_tier_id=t.id and p.is_active and p.session_count=1)), '[]'::jsonb),
    'enrollments', coalesce((select jsonb_agg(jsonb_build_object(
      'id', e.id, 'tierId', p.mentor_tier_id, 'tierName', t.name, 'purchasedSessions', e.purchased_sessions,
      'status', e.status, 'competitionNames', e.competition_names, 'primaryMentorId', e.primary_mentor_id
    ) order by e.created_at desc)
      from public.private_mentoring_enrollments e join public.private_mentoring_packages p on p.id=e.package_id
      join public.mentor_tiers t on t.id=p.mentor_tier_id where e.mentee_id=p_mentee_id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.quote_admin_private_cart_link(
  p_mentee_id uuid, p_mode text, p_mentor_tier_id uuid, p_target_enrollment_id uuid, p_session_count integer
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_quote jsonb; v_enrollment record;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_mode not in ('new_enrollment','top_up') then raise exception 'Invalid Private Mentoring mode' using errcode='22023'; end if;
  if p_mode='top_up' then
    select e.id,e.purchased_sessions,e.competition_names,p.mentor_tier_id,t.name tier_name into v_enrollment
    from public.private_mentoring_enrollments e join public.private_mentoring_packages p on p.id=e.package_id
    join public.mentor_tiers t on t.id=p.mentor_tier_id
    where e.id=p_target_enrollment_id and e.mentee_id=p_mentee_id;
    if not found then raise exception 'Target enrollment does not belong to this mentee' using errcode='42501'; end if;
    if coalesce(array_length(v_enrollment.competition_names,1),0)=0 then raise exception 'Complete the enrollment competition names before creating a top-up' using errcode='22023';end if;
    if v_enrollment.purchased_sessions+p_session_count>100 then raise exception 'Top-up would exceed the 100-session enrollment limit' using errcode='22023';end if;
    v_quote := public.quote_private_mentoring_sessions(v_enrollment.mentor_tier_id,p_session_count);
    return v_quote || jsonb_build_object('mode',p_mode,'targetEnrollmentId',v_enrollment.id,'currentSessionCount',v_enrollment.purchased_sessions,'resultingSessionCount',v_enrollment.purchased_sessions+p_session_count,'competitionNames',v_enrollment.competition_names);
  end if;
  v_quote := public.quote_private_mentoring_sessions(p_mentor_tier_id,p_session_count);
  return v_quote || jsonb_build_object('mode',p_mode,'currentSessionCount',0,'resultingSessionCount',p_session_count);
end;
$$;

create or replace function public.create_flexible_commerce_cart_link(
  p_mentee_id uuid, p_token_hash text, p_commerce_item_ids uuid[], p_private_mode text default null,
  p_mentor_tier_id uuid default null, p_target_enrollment_id uuid default null, p_session_count integer default null,
  p_competition_category_id uuid default null, p_competition_names text[] default '{}'::text[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_link_id uuid; v_offer_id uuid; v_quote jsonb; v_names text[]; v_tier_id uuid; v_current integer:=0; v_target uuid; v_display text; v_items uuid[]:=coalesce(p_commerce_item_ids,'{}'::uuid[]);
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  v_names := public.clean_text_values(p_competition_names,20,300);
  if p_private_mode is not null then
    v_quote := public.quote_admin_private_cart_link(p_mentee_id,p_private_mode,p_mentor_tier_id,p_target_enrollment_id,p_session_count);
    v_tier_id := (v_quote->>'mentorTierId')::uuid;
    v_current := coalesce((v_quote->>'currentSessionCount')::integer,0);
    v_target := case when p_private_mode='top_up' then p_target_enrollment_id end;
    if p_private_mode='top_up' then
      v_names := array(select jsonb_array_elements_text(v_quote->'competitionNames'));
    elsif coalesce(array_length(v_names,1),0)=0 then
      raise exception 'At least one competition name is required' using errcode='22023';
    end if;
    v_display := 'Private Mentoring · '||(v_quote->>'mentorTierName')||' · '||p_session_count||' sesi'||case when p_private_mode='top_up' then ' (top-up)' else '' end;
    insert into public.private_mentoring_cart_link_offers(
      intended_mentee_id,mode,mentor_tier_id,canonical_package_id,target_enrollment_id,session_count,current_session_count,
      locked_total_amount,canonical_price_breakdown,competition_category_id,competition_names,display_name,created_by
    ) values(p_mentee_id,p_private_mode,v_tier_id,(v_quote->>'canonicalPackageId')::uuid,v_target,p_session_count,v_current,
      (v_quote->>'lockedTotalAmount')::bigint,v_quote->'breakdown',p_competition_category_id,v_names,v_display,auth.uid()) returning id into v_offer_id;
    insert into public.commerce_items(id,item_kind,is_available) values(v_offer_id,'private_mentoring',true);
    v_items := v_items || v_offer_id;
  end if;
  if coalesce(array_length(v_items,1),0)=0 then raise exception 'Choose at least one Cart Link item' using errcode='22023'; end if;
  v_link_id := public.create_commerce_cart_link(p_mentee_id,p_token_hash,v_items);
  update public.commerce_cart_links set private_competition_category_id=p_competition_category_id,
    private_competition_name=case when p_private_mode is not null then v_names[1] end where id=v_link_id;
  return v_link_id;
end;
$$;

create or replace function public.resolve_commerce_item(p_commerce_item_id uuid)
returns table(commerce_item_id uuid,item_kind text,name text,slug text,description text,image_path text,price_amount bigint,is_available boolean)
language sql stable security definer set search_path='' as $$
  select ci.id,ci.item_kind,dp.name,dp.slug,dp.description,dp.image_path,dp.price_amount,(ci.is_available and dp.id is not null)
  from public.commerce_items ci left join public.digital_products dp on dp.id=ci.id
  where ci.id=p_commerce_item_id and ci.item_kind='digital_product'
  union all
  select ci.id,ci.item_kind,o.display_name,('private-cart-link-'||o.id::text)::text,
    ('Cart Link '||case when o.mode='top_up' then 'top-up' else 'enrollment baru' end||' · quote terkunci')::text,null::text,
    o.locked_total_amount,(ci.is_available and (o.intended_mentee_id=auth.uid() or public.is_admin() or auth.role()='service_role'))
  from public.commerce_items ci join public.private_mentoring_cart_link_offers o on o.id=ci.id
  where ci.id=p_commerce_item_id and ci.item_kind='private_mentoring'
  union all
  select ci.id,ci.item_kind,'Private Mentoring - '||t.name||' - '||p.session_count||case when p.session_count=1 then ' Session' else ' Sessions' end,
    'private-mentoring-'||lower(replace(t.code,'_','-'))||'-'||p.session_count||case when p.session_count=1 then '-session' else '-sessions' end,
    'Private Mentoring package'::text,null::text,p.price_amount,(ci.is_available and p.is_active and t.is_active)
  from public.commerce_items ci join public.private_mentoring_packages p on p.id=ci.id join public.mentor_tiers t on t.id=p.mentor_tier_id
  where ci.id=p_commerce_item_id and ci.item_kind='private_mentoring'
  union all
  select ci.id,ci.item_kind,p.name,p.slug,p.description,null::text,p.price_amount,(ci.is_available and p.is_active and p.pricing_mode='fixed' and p.price_amount is not null)
  from public.commerce_items ci join public.intensive_mentoring_packages p on p.id=ci.id where ci.id=p_commerce_item_id and ci.item_kind='intensive_mentoring_package'
  union all
  select ci.id,ci.item_kind,a.name,a.slug,a.description,null::text,a.price_amount,(ci.is_available and a.is_active)
  from public.commerce_items ci join public.intensive_mentoring_add_ons a on a.id=ci.id where ci.id=p_commerce_item_id and ci.item_kind='intensive_mentoring_add_on'
  union all
  select ci.id,ci.item_kind,b.name,b.slug,b.description,null::text,b.price_amount,(ci.is_available and b.is_active and not exists(
    select 1 from public.intensive_mentoring_bundle_items bi left join public.intensive_mentoring_packages bp on bp.id=bi.package_id
    left join public.intensive_mentoring_add_ons ba on ba.id=bi.add_on_id where bi.bundle_id=b.id and bi.is_active and
    ((bi.item_type='package' and(bp.id is null or not bp.is_active or bp.pricing_mode<>'fixed'))or(bi.item_type='add_on' and(ba.id is null or not ba.is_active)))))
  from public.commerce_items ci join public.intensive_mentoring_bundles b on b.id=ci.id where ci.id=p_commerce_item_id and ci.item_kind='intensive_mentoring_bundle'
  union all
  select ci.id,ci.item_kind,o.title,('intensive-international-offer-'||o.id::text)::text,('Custom Intensive Mentoring offer · '||o.competition_name)::text,null::text,o.final_price_amount,
    (ci.is_available and o.status='active' and(o.expires_at is null or o.expires_at>now()))
  from public.commerce_items ci join public.intensive_mentoring_custom_offers o on o.id=ci.id where ci.id=p_commerce_item_id and ci.item_kind='intensive_mentoring_custom_offer';
$$;

create or replace function public.fulfill_paid_private_mentoring_order(p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_order public.orders; v_item public.order_items; v_package public.private_mentoring_packages; v_offer public.private_mentoring_cart_link_offers; v_enrollment public.private_mentoring_enrollments; v_previous_count integer;v_start integer;v_legacy_category uuid;v_legacy_name text;
begin
  select * into v_order from public.orders where id=p_order_id;
  if not found or v_order.status<>'paid' then return; end if;
  for v_item in select * from public.order_items where order_id=p_order_id and item_kind_snapshot='private_mentoring' loop
    select * into v_offer from public.private_mentoring_cart_link_offers where id=v_item.commerce_item_id;
    if found then
      if v_offer.intended_mentee_id is distinct from v_order.user_id then raise exception 'Private offer owner mismatch' using errcode='42501'; end if;
      if v_offer.mode='top_up' then
        if exists(select 1 from public.private_mentoring_top_ups where order_item_id=v_item.id) then continue; end if;
        select * into v_enrollment from public.private_mentoring_enrollments where id=v_offer.target_enrollment_id and mentee_id=v_order.user_id for update;
        if not found then raise exception 'Top-up target enrollment is unavailable' using errcode='23503'; end if;
        if not exists(select 1 from public.private_mentoring_packages p where p.id=v_enrollment.package_id and p.mentor_tier_id=v_offer.mentor_tier_id) then raise exception 'Top-up tier mismatch' using errcode='22023'; end if;
        v_previous_count:=v_enrollment.purchased_sessions;
        select greatest(v_previous_count,coalesce(max(session_number),0)) into v_start from public.private_mentoring_sessions where enrollment_id=v_enrollment.id;
        if v_previous_count+v_offer.session_count>100 then raise exception 'Top-up would exceed the 100-session enrollment limit' using errcode='22023'; end if;
        update public.private_mentoring_enrollments set purchased_sessions=v_previous_count+v_offer.session_count,status='active' where id=v_enrollment.id;
        insert into public.private_mentoring_sessions(enrollment_id,session_number)
          select v_enrollment.id,n from generate_series(v_start+1,v_start+v_offer.session_count)n on conflict(enrollment_id,session_number) do nothing;
        insert into public.private_mentoring_top_ups(order_item_id,offer_id,enrollment_id,added_sessions,previous_session_count,resulting_session_count,locked_total_amount,canonical_price_breakdown)
          values(v_item.id,v_offer.id,v_enrollment.id,v_offer.session_count,v_previous_count,v_previous_count+v_offer.session_count,v_offer.locked_total_amount,v_offer.canonical_price_breakdown);
      else
        insert into public.private_mentoring_enrollments(mentee_id,order_item_id,package_id,purchased_sessions,competition_category_id,competition_name,competition_names,competition_updated_at)
        values(v_order.user_id,v_item.id,v_offer.canonical_package_id,v_offer.session_count,v_offer.competition_category_id,v_offer.competition_names[1],v_offer.competition_names,now())
        on conflict(order_item_id) do nothing returning * into v_enrollment;
        if v_enrollment.id is null then select * into v_enrollment from public.private_mentoring_enrollments where order_item_id=v_item.id; end if;
        insert into public.private_mentoring_sessions(enrollment_id,session_number)
          select v_enrollment.id,n from generate_series(1,v_offer.session_count)n on conflict(enrollment_id,session_number) do nothing;
      end if;
    else
      select * into v_package from public.private_mentoring_packages where id=v_item.commerce_item_id;
      if not found then raise exception 'Paid Private Mentoring package is missing' using errcode='23503'; end if;
      v_legacy_category:=null;v_legacy_name:=null;
      select l.private_competition_category_id,l.private_competition_name into v_legacy_category,v_legacy_name
      from public.commerce_cart_links l join public.commerce_cart_link_items li on li.cart_link_id=l.id and li.commerce_item_id=v_item.commerce_item_id
      where l.claimed_cart_id=v_order.cart_id order by l.claimed_at desc nulls last,l.created_at desc limit 1;
      insert into public.private_mentoring_enrollments(mentee_id,order_item_id,package_id,purchased_sessions,competition_category_id,competition_name,competition_names,competition_updated_at)
      values(v_order.user_id,v_item.id,v_package.id,v_package.session_count,v_legacy_category,v_legacy_name,case when v_legacy_name is null then '{}'::text[] else array[v_legacy_name] end,case when v_legacy_name is not null then now() end) on conflict(order_item_id) do nothing returning * into v_enrollment;
      if v_enrollment.id is null then select * into v_enrollment from public.private_mentoring_enrollments where order_item_id=v_item.id; end if;
      insert into public.private_mentoring_sessions(enrollment_id,session_number)
        select v_enrollment.id,n from generate_series(1,v_package.session_count)n on conflict(enrollment_id,session_number) do nothing;
    end if;
  end loop;
end;
$$;

create or replace function public.add_cart_item(p_commerce_item_id uuid) returns public.cart_items
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=public.current_completed_mentee_id();v_cart public.carts;v_item record;v_cart_item public.cart_items;
begin
  if exists(select 1 from public.private_mentoring_cart_link_offers where id=p_commerce_item_id) then
    raise exception 'This Private Mentoring quote can only be claimed from its Cart Link' using errcode='42501';
  end if;
  select * into v_item from public.resolve_commerce_item(p_commerce_item_id);
  if not found or v_item.is_available is distinct from true or v_item.name is null or v_item.price_amount is null then raise exception 'Commerce Item is unavailable' using errcode='22023';end if;
  if v_item.item_kind='intensive_mentoring_custom_offer' and not exists(select 1 from public.intensive_mentoring_custom_offers o where o.id=p_commerce_item_id and o.intended_mentee_id=v_uid) then raise exception 'International custom offer belongs to another mentee' using errcode='42501';end if;
  if v_item.item_kind='digital_product' and exists(select 1 from public.orders o join public.order_items oi on oi.order_id=o.id where o.user_id=v_uid and o.status='paid' and oi.commerce_item_id=p_commerce_item_id and oi.item_kind_snapshot='digital_product') then raise exception 'Digital Product is already owned' using errcode='22023';end if;
  v_cart:=public.get_or_create_active_cart();
  if exists(select 1 from public.cart_items ci where ci.cart_id=v_cart.id and ci.commerce_item_id=p_commerce_item_id) then raise exception 'Commerce Item is already in cart' using errcode='22023';end if;
  insert into public.cart_items(cart_id,commerce_item_id) values(v_cart.id,p_commerce_item_id) returning * into v_cart_item;return v_cart_item;
end;$$;

revoke all on function public.quote_private_mentoring_sessions(uuid,integer), public.list_admin_private_cart_link_context(uuid),
  public.quote_admin_private_cart_link(uuid,text,uuid,uuid,integer),
  public.create_flexible_commerce_cart_link(uuid,text,uuid[],text,uuid,uuid,integer,uuid,text[]) from public,anon;
grant execute on function public.quote_private_mentoring_sessions(uuid,integer), public.list_admin_private_cart_link_context(uuid),
  public.quote_admin_private_cart_link(uuid,text,uuid,uuid,integer),
  public.create_flexible_commerce_cart_link(uuid,text,uuid[],text,uuid,uuid,integer,uuid,text[]) to authenticated,service_role;

create or replace function public.get_mentoring_competition_names(p_kind text, p_parent_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; v_owner uuid; v_primary uuid;
begin
  if p_kind='private' then
    select e.mentee_id,e.primary_mentor_id,jsonb_build_object('parentId',e.id,'competitionNames',e.competition_names,'competitionCategoryId',e.competition_category_id)
      into v_owner,v_primary,v_result from public.private_mentoring_enrollments e where e.id=p_parent_id;
    if not found then raise exception 'Enrollment not found' using errcode='22023';end if;
    if not public.is_admin() and auth.uid() is distinct from v_owner and auth.uid() is distinct from v_primary
      and not exists(select 1 from public.private_mentoring_sessions s where s.enrollment_id=p_parent_id and s.mentor_id=auth.uid())
    then raise exception 'Forbidden' using errcode='42501';end if;
  elsif p_kind='intensive' then
    select e.mentee_id,e.primary_mentor_id,jsonb_build_object('parentId',e.id,'competitionNames',e.competition_names,'competitionCategoryId',e.competition_category_id)
      into v_owner,v_primary,v_result from public.intensive_mentoring_engagements e where e.id=p_parent_id;
    if not found then raise exception 'Engagement not found' using errcode='22023';end if;
    if not public.is_admin() and auth.uid() is distinct from v_owner and auth.uid() is distinct from v_primary
      and not exists(select 1 from public.intensive_mentoring_sessions s where s.engagement_id=p_parent_id and s.mentor_id=auth.uid())
    then raise exception 'Forbidden' using errcode='42501';end if;
  else raise exception 'Invalid mentoring kind' using errcode='22023';
  end if;
  return v_result;
end;
$$;

create or replace function public.set_mentoring_competition_names(p_kind text,p_parent_id uuid,p_competition_names text[],p_competition_category_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_names text[];v_owner uuid;v_result jsonb;
begin
  v_names:=public.clean_text_values(p_competition_names,20,300);
  if coalesce(array_length(v_names,1),0)=0 then raise exception 'At least one competition name is required' using errcode='22023';end if;
  if coalesce(array_length(p_competition_names,1),0)>20 or exists(select 1 from unnest(p_competition_names) value where char_length(btrim(value))>300) then
    raise exception 'Competition names exceed the supported limit' using errcode='22023';end if;
  if p_competition_category_id is not null and not exists(select 1 from public.competition_categories where id=p_competition_category_id and is_active) then
    raise exception 'Active competition category required' using errcode='22023';end if;
  if p_kind='private' then
    select mentee_id into v_owner from public.private_mentoring_enrollments where id=p_parent_id for update;
    if not found then raise exception 'Enrollment not found' using errcode='22023';end if;
    if not public.is_admin() and auth.uid() is distinct from v_owner then raise exception 'Forbidden' using errcode='42501';end if;
    update public.private_mentoring_enrollments set competition_names=v_names,competition_category_id=p_competition_category_id,competition_updated_at=now() where id=p_parent_id;
  elsif p_kind='intensive' then
    select mentee_id into v_owner from public.intensive_mentoring_engagements where id=p_parent_id for update;
    if not found then raise exception 'Engagement not found' using errcode='22023';end if;
    if not public.is_admin() and auth.uid() is distinct from v_owner then raise exception 'Forbidden' using errcode='42501';end if;
    update public.intensive_mentoring_engagements set competition_names=v_names,competition_category_id=p_competition_category_id where id=p_parent_id;
  else raise exception 'Invalid mentoring kind' using errcode='22023';
  end if;
  return public.get_mentoring_competition_names(p_kind,p_parent_id);
end;
$$;

create or replace function public.get_mentoring_session_preferences(p_kind text,p_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;v_owner uuid;v_mentor uuid;v_primary uuid;
begin
  if p_kind='private' then
    select e.mentee_id,s.mentor_id,e.primary_mentor_id,jsonb_build_object(
      'sessionId',s.id,'parentId',e.id,'kind','private','topicStatus',s.topic_status,
      'requestedFocusId',s.requested_focus_id,'requestedFocusName',rf.name,'requestedCustomFocus',s.requested_focus_custom_text,
      'requestedTopic',s.mentee_topic_request,'focusId',s.session_focus_id,'focusName',f.name,
      'customFocus',s.final_focus_custom_text,'topic',s.resolved_topic,'supportingMaterials',s.supporting_materials,
      'mentorNotes',s.mentor_scope_notes,'competitionNames',e.competition_names
    ) into v_owner,v_mentor,v_primary,v_result
    from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id
    left join public.private_mentoring_session_focuses rf on rf.id=s.requested_focus_id
    left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id where s.id=p_session_id;
  elsif p_kind='intensive' then
    select e.mentee_id,s.mentor_id,e.primary_mentor_id,jsonb_build_object(
      'sessionId',s.id,'parentId',e.id,'kind','intensive','topicStatus',s.topic_status,
      'requestedFocusId',s.requested_focus_id,'requestedFocusName',rf.name,'requestedCustomFocus',s.requested_focus_custom_text,
      'requestedTopic',s.mentee_topic_request,'focusId',s.session_focus_id,'focusName',f.name,
      'customFocus',s.final_focus_custom_text,'topic',s.resolved_topic,'supportingMaterials',s.supporting_materials,
      'mentorNotes',s.mentor_scope_notes,'competitionNames',e.competition_names
    ) into v_owner,v_mentor,v_primary,v_result
    from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements e on e.id=s.engagement_id
    left join public.private_mentoring_session_focuses rf on rf.id=s.requested_focus_id
    left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id where s.id=p_session_id;
  else raise exception 'Invalid mentoring kind' using errcode='22023';end if;
  if v_result is null then raise exception 'Mentoring session not found' using errcode='22023';end if;
  if not public.is_admin() and auth.uid() is distinct from v_owner and auth.uid() is distinct from v_mentor and auth.uid() is distinct from v_primary then raise exception 'Forbidden' using errcode='42501';end if;
  return v_result;
end;
$$;

create or replace function public.save_mentoring_session_preferences(
  p_kind text,p_session_id uuid,p_focus_id uuid default null,p_custom_focus text default null,
  p_topic text default null,p_supporting_materials text[] default '{}'::text[],p_mentor_notes text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid;v_custom text:=nullif(btrim(coalesce(p_custom_focus,'')),'');v_topic text:=nullif(btrim(coalesce(p_topic,'')),'');v_notes text:=nullif(btrim(coalesce(p_mentor_notes,'')),'');v_materials text[];v_admin boolean:=public.is_admin();
begin
  v_materials:=public.clean_text_values(p_supporting_materials,20,1000);
  if coalesce(array_length(p_supporting_materials,1),0)>20 or exists(select 1 from unnest(p_supporting_materials) value where char_length(btrim(value))>1000) then raise exception 'Supporting materials exceed the supported limit' using errcode='22023';end if;
  if v_custom is not null and char_length(v_custom)>300 then raise exception 'Custom focus is too long' using errcode='22023';end if;
  if v_topic is not null and char_length(v_topic)>3000 then raise exception 'Topic is too long' using errcode='22023';end if;
  if p_focus_id is not null and not exists(select 1 from public.private_mentoring_session_focuses where id=p_focus_id and is_active) then raise exception 'Active focus required' using errcode='22023';end if;
  if p_kind='private' then
    select e.mentee_id into v_owner from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where s.id=p_session_id for update of s;
    if not found then raise exception 'Session not found' using errcode='22023';end if;
    if not v_admin and auth.uid() is distinct from v_owner then raise exception 'Forbidden' using errcode='42501';end if;
    if v_admin then
      update public.private_mentoring_sessions set session_focus_id=p_focus_id,final_focus_custom_text=case when p_focus_id is null then v_custom end,
        resolved_topic=v_topic,mentor_scope_notes=v_notes,supporting_materials=v_materials,topic_status='confirmed',
        status=case when status='awaiting_focus' then 'awaiting_scheduling' else status end where id=p_session_id;
    else
      update public.private_mentoring_sessions set requested_focus_id=p_focus_id,requested_focus_custom_text=case when p_focus_id is null then v_custom end,
        mentee_topic_request=v_topic,supporting_materials=v_materials,topic_status='pending_review' where id=p_session_id;
    end if;
  elsif p_kind='intensive' then
    select e.mentee_id into v_owner from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements e on e.id=s.engagement_id where s.id=p_session_id for update of s;
    if not found then raise exception 'Session not found' using errcode='22023';end if;
    if not v_admin and auth.uid() is distinct from v_owner then raise exception 'Forbidden' using errcode='42501';end if;
    if v_admin then
      update public.intensive_mentoring_sessions set session_focus_id=p_focus_id,final_focus_custom_text=case when p_focus_id is null then v_custom end,
        resolved_topic=v_topic,mentor_scope_notes=v_notes,supporting_materials=v_materials,topic_status='confirmed',
        status=case when status='awaiting_focus' then 'awaiting_scheduling' else status end where id=p_session_id;
    else
      update public.intensive_mentoring_sessions set requested_focus_id=p_focus_id,requested_focus_custom_text=case when p_focus_id is null then v_custom end,
        mentee_topic_request=v_topic,supporting_materials=v_materials,topic_status='pending_review' where id=p_session_id;
    end if;
  else raise exception 'Invalid mentoring kind' using errcode='22023';end if;
  return public.get_mentoring_session_preferences(p_kind,p_session_id);
end;
$$;

revoke all on function public.get_mentoring_competition_names(text,uuid),public.set_mentoring_competition_names(text,uuid,text[],uuid),
 public.get_mentoring_session_preferences(text,uuid),public.save_mentoring_session_preferences(text,uuid,uuid,text,text,text[],text) from public,anon;
grant execute on function public.get_mentoring_competition_names(text,uuid),public.set_mentoring_competition_names(text,uuid,text[],uuid),
 public.get_mentoring_session_preferences(text,uuid),public.save_mentoring_session_preferences(text,uuid,uuid,text,text,text[],text) to authenticated,service_role;

-- Include the new structured fields in the existing bounded invalidation model.
create or replace function public.invalidate_private_enrollment_operational_changes()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform public.bump_operational_invalidation('mentee'::public.app_role,new.mentee_id,'mentoring');
  perform public.bump_operational_invalidation('admin'::public.app_role,null,'admin-overview');
  perform public.bump_operational_invalidation('admin'::public.app_role,null,'mentoring');
  if old.primary_mentor_id is not null and old.primary_mentor_id is distinct from new.primary_mentor_id then
    perform public.bump_operational_invalidation('mentor'::public.app_role,old.primary_mentor_id,'mentor-dashboard');
  end if;
  if new.primary_mentor_id is not null then
    perform public.bump_operational_invalidation('mentor'::public.app_role,new.primary_mentor_id,'mentor-dashboard');
  end if;
  return new;
end;$$;
drop trigger if exists private_enrollments_operational_invalidation on public.private_mentoring_enrollments;
create trigger private_enrollments_operational_invalidation after insert or update of status,primary_mentor_id,learning_path_id,competition_category_id,competition_name,competition_names,purchased_sessions
on public.private_mentoring_enrollments for each row execute function public.invalidate_private_enrollment_operational_changes();

create or replace function public.invalidate_intensive_engagement_operational_changes()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform public.bump_operational_invalidation('mentee'::public.app_role,new.mentee_id,'mentoring');
  perform public.bump_operational_invalidation('admin'::public.app_role,null,'admin-overview');
  perform public.bump_operational_invalidation('admin'::public.app_role,null,'mentoring');
  if old.primary_mentor_id is not null and old.primary_mentor_id is distinct from new.primary_mentor_id then perform public.bump_operational_invalidation('mentor'::public.app_role,old.primary_mentor_id,'mentor-dashboard');end if;
  if new.primary_mentor_id is not null then perform public.bump_operational_invalidation('mentor'::public.app_role,new.primary_mentor_id,'mentor-dashboard');end if;
  return new;
end;$$;
drop trigger if exists intensive_engagements_operational_invalidation on public.intensive_mentoring_engagements;
create trigger intensive_engagements_operational_invalidation after insert or update of status,primary_mentor_id,competition_category_id,competition_name,competition_names,program_stage,progress_summary
on public.intensive_mentoring_engagements for each row execute function public.invalidate_intensive_engagement_operational_changes();

create or replace function public.invalidate_flexible_session_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_mentee uuid;
begin
  if tg_table_name='private_mentoring_sessions' then select mentee_id into v_mentee from public.private_mentoring_enrollments where id=new.enrollment_id;
  else select mentee_id into v_mentee from public.intensive_mentoring_engagements where id=new.engagement_id;end if;
  perform public.bump_operational_invalidation('mentee'::public.app_role,v_mentee,'mentoring');
  perform public.bump_operational_invalidation('admin'::public.app_role,null,'admin-overview');
  perform public.bump_operational_invalidation('admin'::public.app_role,null,'mentoring');
  if new.mentor_id is not null then
    perform public.bump_operational_invalidation('mentor'::public.app_role,new.mentor_id,'mentoring');
    perform public.bump_operational_invalidation('mentor'::public.app_role,new.mentor_id,'mentor-dashboard');
  end if;
  return new;
end;$$;
create trigger private_flexible_session_invalidation after update of requested_focus_custom_text,final_focus_custom_text,supporting_materials
on public.private_mentoring_sessions for each row execute function public.invalidate_flexible_session_change();
create trigger intensive_flexible_session_invalidation after update of requested_focus_custom_text,final_focus_custom_text,supporting_materials,mentor_scope_notes
on public.intensive_mentoring_sessions for each row execute function public.invalidate_flexible_session_change();

-- Stable, collision-safe slugs for user-managed records. Existing slugs are preserved on edit.
create or replace function public.assign_insert_slug()
returns trigger language plpgsql set search_path='' as $$
declare v_base text;v_candidate text;v_suffix integer:=1;v_exists boolean;
begin
  v_base:=trim(both '-' from regexp_replace(lower(coalesce(nullif(btrim(to_jsonb(new)->>'slug'),''),to_jsonb(new)->>tg_argv[0],'item')),'[^a-z0-9]+','-','g'));
  if char_length(v_base)<3 then v_base:='item-'||substr(md5(coalesce(to_jsonb(new)->>tg_argv[0],'item')),1,8);end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tg_table_schema||'.'||tg_table_name||':'||v_base,0));
  v_candidate:=left(v_base,150);
  loop
    execute format('select exists(select 1 from %I.%I where slug=$1)',tg_table_schema,tg_table_name) into v_exists using v_candidate;
    exit when not v_exists;
    v_suffix:=v_suffix+1;v_candidate:=left(v_base,145)||'-'||v_suffix;
  end loop;
  new:=jsonb_populate_record(new,jsonb_build_object('slug',v_candidate));return new;
end;$$;
do $$
declare r record;
begin
  for r in select * from (values
    ('publications','title'),('competitions','name'),('digital_products','name'),('marketing_testimonials','competition_name'),
    ('mentor_expertise','name'),('competition_categories','name'),('private_mentoring_learning_paths','name'),
    ('private_mentoring_session_focuses','name'),('intensive_mentoring_packages','name'),('intensive_mentoring_add_ons','name'),('intensive_mentoring_bundles','name')
  ) as values_list(table_name,source_column)
  loop
    if to_regclass('public.'||r.table_name) is not null then
      execute format('drop trigger if exists automatic_insert_slug on public.%I',r.table_name);
      execute format('create trigger automatic_insert_slug before insert on public.%I for each row execute function public.assign_insert_slug(%L)',r.table_name,r.source_column);
    end if;
  end loop;
end$$;

-- Scheduling requires Admin review plus competition context, never optional focus/topic/materials.
drop function if exists public.admin_schedule_private_mentoring_session(uuid,uuid,timestamptz);
create or replace function public.admin_schedule_private_mentoring_session(
  p_session_id uuid,p_mentor_id uuid,p_scheduled_start_at timestamptz,p_zoom_room_id uuid default null
) returns public.private_mentoring_sessions language plpgsql security definer set search_path='' as $$
declare v_session public.private_mentoring_sessions;v_required_tier uuid;v_duration integer;v_purchased integer;v_primary uuid;v_mentor_tier uuid;v_mentor_active boolean;v_timezone text;v_end timestamptz;v_local_start timestamp;v_local_end timestamp;v_week_start date;v_day smallint;v_mentee uuid;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
  if p_scheduled_start_at is null or p_scheduled_start_at<=now() then raise exception 'Schedule must be in the future' using errcode='22023';end if;
  select * into v_session from public.private_mentoring_sessions where id=p_session_id for update;
  if not found then raise exception 'Private Mentoring session not found' using errcode='22023';end if;
  select pkg.mentor_tier_id,pkg.duration_minutes,e.purchased_sessions,e.primary_mentor_id,e.mentee_id
    into v_required_tier,v_duration,v_purchased,v_primary,v_mentee
  from public.private_mentoring_enrollments e join public.private_mentoring_packages pkg on pkg.id=e.package_id
  where e.id=v_session.enrollment_id and coalesce(array_length(e.competition_names,1),0)>0;
  if not found then raise exception 'Complete at least one competition name before scheduling' using errcode='22023';end if;
  if v_session.topic_status<>'confirmed' then raise exception 'Admin review is required before scheduling' using errcode='22023';end if;
  if v_session.status not in('awaiting_scheduling','scheduled') then raise exception 'Session is not schedulable' using errcode='22023';end if;
  if v_purchased>=5 and v_primary is null then raise exception 'Set the enrollment primary mentor before scheduling' using errcode='22023';end if;
  if v_purchased>=5 and p_mentor_id is distinct from v_primary then raise exception 'This enrollment must use its primary mentor' using errcode='22023';end if;
  select mp.tier_id,mp.is_active,mp.timezone into v_mentor_tier,v_mentor_active,v_timezone
  from public.mentor_profiles mp join public.profiles p on p.id=mp.user_id and p.role='mentor'::public.app_role where mp.user_id=p_mentor_id;
  if not found or not v_mentor_active then raise exception 'Active mentor required' using errcode='22023';end if;
  if v_mentor_tier is distinct from v_required_tier then raise exception 'Mentor tier does not match purchased package' using errcode='22023';end if;
  v_end:=p_scheduled_start_at+make_interval(mins=>v_duration);v_local_start:=p_scheduled_start_at at time zone v_timezone;v_local_end:=v_end at time zone v_timezone;
  v_week_start:=date_trunc('week',v_local_start)::date;v_day:=extract(isodow from v_local_start)::smallint;
  if v_local_end::date<>v_local_start::date or not exists(select 1 from public.mentor_availability_rules a where a.mentor_id=p_mentor_id and a.week_start_date=v_week_start and a.day_of_week=v_day and a.start_time<=v_local_start::time and a.end_time>=v_local_end::time)
    then raise exception 'Selected slot is outside declared mentor availability' using errcode='22023';end if;
  if exists(select 1 from public.private_mentoring_sessions s where s.id<>p_session_id and s.mentor_id=p_mentor_id and s.status in('scheduled','completed') and tstzrange(s.scheduled_start_at,s.scheduled_end_at,'[)')&&tstzrange(p_scheduled_start_at,v_end,'[)'))
    or exists(select 1 from public.intensive_mentoring_sessions s where s.mentor_id=p_mentor_id and s.status in('scheduled','completed') and tstzrange(s.scheduled_start_at,s.scheduled_end_at,'[)')&&tstzrange(p_scheduled_start_at,v_end,'[)'))
    then raise exception 'Selected slot conflicts with another mentor session' using errcode='23P01';end if;
  if exists(select 1 from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where s.id<>p_session_id and e.mentee_id=v_mentee and s.status in('scheduled','completed') and tstzrange(s.scheduled_start_at,s.scheduled_end_at,'[)')&&tstzrange(p_scheduled_start_at,v_end,'[)'))
    or exists(select 1 from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements e on e.id=s.engagement_id where e.mentee_id=v_mentee and s.status in('scheduled','completed') and tstzrange(s.scheduled_start_at,s.scheduled_end_at,'[)')&&tstzrange(p_scheduled_start_at,v_end,'[)'))
    then raise exception 'Selected slot conflicts with another mentee session' using errcode='23P01';end if;
  perform public.reserve_mentoring_zoom_room(p_session_id,null,p_scheduled_start_at,v_end,p_zoom_room_id);
  update public.private_mentoring_sessions set mentor_id=p_mentor_id,scheduled_start_at=p_scheduled_start_at,scheduled_end_at=v_end,status='scheduled' where id=p_session_id returning * into v_session;
  insert into public.private_mentoring_session_calendar_integrations(session_id,organizer_user_id,sync_status,sync_error)
  values(p_session_id,auth.uid(),'pending',null) on conflict(session_id) do update set sync_status='pending',sync_error=null,organizer_user_id=coalesce(public.private_mentoring_session_calendar_integrations.organizer_user_id,excluded.organizer_user_id);
  return v_session;
end;$$;

drop function if exists public.admin_schedule_intensive_mentoring_session(uuid,uuid,timestamptz);
create or replace function public.admin_schedule_intensive_mentoring_session(
  p_session_id uuid,p_mentor_id uuid,p_scheduled_start_at timestamptz,p_zoom_room_id uuid default null
) returns public.intensive_mentoring_sessions language plpgsql security definer set search_path='' as $$
declare v_session public.intensive_mentoring_sessions;v_eng public.intensive_mentoring_engagements;v_timezone text;v_end timestamptz;v_local_start timestamp;v_local_end timestamp;v_week_start date;v_day smallint;v_previous_status text;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
  if p_scheduled_start_at is null or p_scheduled_start_at<=now() then raise exception 'Future schedule required' using errcode='22023';end if;
  select * into v_session from public.intensive_mentoring_sessions where id=p_session_id for update;
  if not found or v_session.status not in('awaiting_scheduling','scheduled') then raise exception 'Schedulable Intensive session required' using errcode='22023';end if;
  if v_session.topic_status<>'confirmed' then raise exception 'Admin review is required before scheduling' using errcode='22023';end if;
  select * into v_eng from public.intensive_mentoring_engagements where id=v_session.engagement_id and coalesce(array_length(competition_names,1),0)>0;
  if not found then raise exception 'Complete at least one competition name before scheduling' using errcode='22023';end if;
  v_previous_status:=v_session.status;
  select mp.timezone into v_timezone from public.mentor_profiles mp join public.profiles p on p.id=mp.user_id where mp.user_id=p_mentor_id and mp.is_active and p.role='mentor'::public.app_role;
  if not found then raise exception 'Active mentor required' using errcode='22023';end if;
  v_end:=p_scheduled_start_at+make_interval(mins=>v_session.duration_minutes);v_local_start:=p_scheduled_start_at at time zone v_timezone;v_local_end:=v_end at time zone v_timezone;
  v_week_start:=date_trunc('week',v_local_start)::date;v_day:=extract(isodow from v_local_start)::smallint;
  if v_local_end::date<>v_local_start::date or not exists(select 1 from public.mentor_availability_rules a where a.mentor_id=p_mentor_id and a.week_start_date=v_week_start and a.day_of_week=v_day and a.start_time<=v_local_start::time and a.end_time>=v_local_end::time)
    then raise exception 'Selected slot is outside declared mentor availability' using errcode='22023';end if;
  if exists(select 1 from public.private_mentoring_sessions s where s.mentor_id=p_mentor_id and s.status in('scheduled','completed') and tstzrange(s.scheduled_start_at,s.scheduled_end_at,'[)')&&tstzrange(p_scheduled_start_at,v_end,'[)'))
    or exists(select 1 from public.intensive_mentoring_sessions s where s.id<>p_session_id and s.mentor_id=p_mentor_id and s.status in('scheduled','completed') and tstzrange(s.scheduled_start_at,s.scheduled_end_at,'[)')&&tstzrange(p_scheduled_start_at,v_end,'[)'))
    then raise exception 'Selected slot conflicts with another mentor session' using errcode='23P01';end if;
  if exists(select 1 from public.private_mentoring_sessions s join public.private_mentoring_enrollments e on e.id=s.enrollment_id where e.mentee_id=v_eng.mentee_id and s.status in('scheduled','completed') and tstzrange(s.scheduled_start_at,s.scheduled_end_at,'[)')&&tstzrange(p_scheduled_start_at,v_end,'[)'))
    or exists(select 1 from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements e on e.id=s.engagement_id where s.id<>p_session_id and e.mentee_id=v_eng.mentee_id and s.status in('scheduled','completed') and tstzrange(s.scheduled_start_at,s.scheduled_end_at,'[)')&&tstzrange(p_scheduled_start_at,v_end,'[)'))
    then raise exception 'Selected slot conflicts with another mentee session' using errcode='23P01';end if;
  perform public.reserve_mentoring_zoom_room(null,p_session_id,p_scheduled_start_at,v_end,p_zoom_room_id);
  update public.intensive_mentoring_sessions set mentor_id=p_mentor_id,scheduled_start_at=p_scheduled_start_at,scheduled_end_at=v_end,status='scheduled' where id=p_session_id returning * into v_session;
  insert into public.intensive_mentoring_session_calendar_integrations(session_id,organizer_user_id,sync_status,sync_error)
  values(p_session_id,auth.uid(),'pending',null) on conflict(session_id) do update set organizer_user_id=coalesce(public.intensive_mentoring_session_calendar_integrations.organizer_user_id,excluded.organizer_user_id),sync_status='pending',sync_error=null;
  insert into public.intensive_mentoring_session_events(session_id,event_type,actor_user_id,from_status,to_status,metadata)
  values(p_session_id,case when v_previous_status='scheduled' then 'rescheduled' else 'scheduled' end,auth.uid(),v_previous_status,'scheduled',jsonb_build_object('mentorId',p_mentor_id,'start',p_scheduled_start_at,'end',v_end));
  perform public.emit_notification(v_eng.mentee_id,'mentee'::public.app_role,'session_scheduled','Sesi Intensive Mentoring dijadwalkan','Sesi Intensive Mentoring kamu telah dijadwalkan.','intensive_mentoring_session',p_session_id::text,'intensive:schedule:mentee:'||p_session_id::text||':'||extract(epoch from p_scheduled_start_at)::bigint::text);
  perform public.emit_notification(p_mentor_id,'mentor'::public.app_role,'session_scheduled','Sesi Intensive Mentoring dijadwalkan','Sesi Intensive Mentoring baru telah dijadwalkan untuk kamu.','intensive_mentoring_session',p_session_id::text,'intensive:schedule:mentor:'||p_session_id::text||':'||extract(epoch from p_scheduled_start_at)::bigint::text);
  return v_session;
end;$$;

create or replace function public.admin_set_private_mentoring_session_status(p_session_id uuid,p_status text)
returns public.private_mentoring_sessions language plpgsql security definer set search_path='' as $$
declare v_session public.private_mentoring_sessions;v_from text;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
  if p_status not in('completed','scheduled') then raise exception 'Unsupported status transition' using errcode='22023';end if;
  select * into v_session from public.private_mentoring_sessions where id=p_session_id for update;
  if not found then raise exception 'Private Mentoring session not found' using errcode='22023';end if;
  if v_session.status=p_status then return v_session;end if;
  if not((v_session.status='scheduled' and p_status='completed')or(v_session.status='completed' and p_status='scheduled')) then raise exception 'Only scheduled/completed transitions are allowed' using errcode='22023';end if;
  if p_status='scheduled' then perform public.reserve_mentoring_zoom_room(p_session_id,null,v_session.scheduled_start_at,v_session.scheduled_end_at,null);end if;
  v_from:=v_session.status::text;update public.private_mentoring_sessions set status=p_status where id=p_session_id returning * into v_session;
  if p_status='completed' then update public.mentoring_zoom_room_allocations set released_at=coalesce(released_at,now()) where private_session_id=p_session_id;end if;
  insert into public.private_mentoring_session_status_events(session_id,from_status,to_status,actor_id) values(p_session_id,v_from,p_status,auth.uid());
  if p_status='scheduled' then update public.private_mentoring_enrollments set status='active' where id=v_session.enrollment_id;
  elsif not exists(select 1 from public.private_mentoring_sessions s where s.enrollment_id=v_session.enrollment_id and s.status not in('completed','cancelled')) then update public.private_mentoring_enrollments set status='completed' where id=v_session.enrollment_id;
  else update public.private_mentoring_enrollments set status='active' where id=v_session.enrollment_id;end if;
  return v_session;
end;$$;

revoke all on function public.admin_schedule_private_mentoring_session(uuid,uuid,timestamptz,uuid),public.admin_schedule_intensive_mentoring_session(uuid,uuid,timestamptz,uuid),public.admin_set_private_mentoring_session_status(uuid,text) from public,anon;
grant execute on function public.admin_schedule_private_mentoring_session(uuid,uuid,timestamptz,uuid),public.admin_schedule_intensive_mentoring_session(uuid,uuid,timestamptz,uuid),public.admin_set_private_mentoring_session_status(uuid,text) to authenticated,service_role;
