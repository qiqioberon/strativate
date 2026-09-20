-- 2026-09-21: activate approved Intensive guarantee commerce, add International custom offers,
-- extend paid entitlement -> engagement reconciliation, and repair rerunnable Intensive RLS policies.

-- Latest stakeholder approval supersedes the earlier inactive legal guard.
drop trigger if exists intensive_legal_blocked_add_on_guard on public.intensive_mentoring_add_ons;
drop trigger if exists intensive_legal_blocked_bundle_guard on public.intensive_mentoring_bundles;
drop function if exists public.guard_intensive_legal_blocked_add_on();
drop function if exists public.guard_intensive_legal_blocked_bundle();

update public.intensive_mentoring_add_ons
set price_amount=500000,is_active=true
where code='WIN_GUARANTEE_PROTECTION';

update public.intensive_mentoring_bundles
set price_amount=3000000,is_active=true
where code='COMPETITION_ASSURANCE';

insert into public.commerce_items(id,item_kind,is_available,created_at,updated_at)
select id,'intensive_mentoring_add_on',true,created_at,updated_at
from public.intensive_mentoring_add_ons where code='WIN_GUARANTEE_PROTECTION'
on conflict(id) do update set item_kind=excluded.item_kind,is_available=true,updated_at=excluded.updated_at;

insert into public.commerce_items(id,item_kind,is_available,created_at,updated_at)
select id,'intensive_mentoring_bundle',true,created_at,updated_at
from public.intensive_mentoring_bundles where code='COMPETITION_ASSURANCE'
on conflict(id) do update set item_kind=excluded.item_kind,is_available=true,updated_at=excluded.updated_at;

-- Program progress keeps the canonical six-stage enum and adds separate operational context.
alter table public.intensive_mentoring_engagements
  add column if not exists current_activity text;
alter table public.intensive_mentoring_engagements
  drop constraint if exists intensive_mentoring_engagements_current_activity_check;
alter table public.intensive_mentoring_engagements
  add constraint intensive_mentoring_engagements_current_activity_check
  check(current_activity is null or char_length(btrim(current_activity)) between 1 and 500);

-- International custom offers are private, intended-recipient commerce sources.
create table if not exists public.intensive_mentoring_custom_offers(
  id uuid primary key default gen_random_uuid(),
  intended_mentee_id uuid not null references public.profiles(id),
  title text not null check(char_length(btrim(title)) between 2 and 200),
  competition_category_id uuid references public.competition_categories(id),
  competition_name text not null check(char_length(btrim(competition_name)) between 2 and 300),
  baseline_sessions_per_month integer check(baseline_sessions_per_month is null or baseline_sessions_per_month between 1 and 100),
  final_price_amount bigint not null check(final_price_amount between 1 and 9007199254740991),
  status text not null default 'active' check(status in ('draft','active','converted','purchased','cancelled','expired')),
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists intensive_custom_offers_mentee_idx
  on public.intensive_mentoring_custom_offers(intended_mentee_id,status,created_at desc,id);
create index if not exists intensive_custom_offers_status_expiry_idx
  on public.intensive_mentoring_custom_offers(status,expires_at,id);

drop trigger if exists intensive_custom_offers_touch_updated_at on public.intensive_mentoring_custom_offers;
create trigger intensive_custom_offers_touch_updated_at
before update on public.intensive_mentoring_custom_offers
for each row execute function public.touch_updated_at();

create table if not exists public.intensive_mentoring_custom_offer_items(
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.intensive_mentoring_custom_offers(id) on delete cascade,
  item_type text not null check(item_type in ('add_on','benefit')),
  add_on_id uuid references public.intensive_mentoring_add_ons(id),
  benefit_text text check(benefit_text is null or char_length(btrim(benefit_text)) between 1 and 500),
  sort_order integer not null default 0 check(sort_order>=0),
  created_at timestamptz not null default now(),
  check(
    (item_type='add_on' and add_on_id is not null and benefit_text is null)
    or (item_type='benefit' and add_on_id is null and benefit_text is not null)
  )
);
create index if not exists intensive_custom_offer_items_offer_idx
  on public.intensive_mentoring_custom_offer_items(offer_id,sort_order,id);
create unique index if not exists intensive_custom_offer_add_on_unique
  on public.intensive_mentoring_custom_offer_items(offer_id,add_on_id)
  where item_type='add_on';

alter table public.intensive_mentoring_custom_offers enable row level security;
alter table public.intensive_mentoring_custom_offer_items enable row level security;
drop policy if exists intensive_custom_offers_admin_read on public.intensive_mentoring_custom_offers;
create policy intensive_custom_offers_admin_read on public.intensive_mentoring_custom_offers
for select to authenticated using(public.is_admin());
drop policy if exists intensive_custom_offer_items_admin_read on public.intensive_mentoring_custom_offer_items;
create policy intensive_custom_offer_items_admin_read on public.intensive_mentoring_custom_offer_items
for select to authenticated using(public.is_admin());
revoke all on public.intensive_mentoring_custom_offers,public.intensive_mentoring_custom_offer_items from public,anon,authenticated;
grant select on public.intensive_mentoring_custom_offers,public.intensive_mentoring_custom_offer_items to authenticated;
grant all on public.intensive_mentoring_custom_offers,public.intensive_mentoring_custom_offer_items to service_role;

create or replace function public.sync_intensive_custom_offer_commerce_item()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.commerce_items(id,item_kind,is_available,created_at,updated_at)
 values(new.id,'intensive_mentoring_custom_offer',new.status='active',new.created_at,new.updated_at)
 on conflict(id) do update set
   item_kind=excluded.item_kind,
   is_available=excluded.is_available,
   updated_at=excluded.updated_at;
 return new;
end; $$;
drop trigger if exists intensive_custom_offers_sync_commerce_item on public.intensive_mentoring_custom_offers;
create trigger intensive_custom_offers_sync_commerce_item
after insert or update of status,title,competition_name,final_price_amount,expires_at on public.intensive_mentoring_custom_offers
for each row execute function public.sync_intensive_custom_offer_commerce_item();

create or replace function public.retire_intensive_custom_offer_commerce_item()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.commerce_items set is_available=false where id=old.id and item_kind='intensive_mentoring_custom_offer';
 return old;
end; $$;
drop trigger if exists intensive_custom_offers_retire_commerce_item on public.intensive_mentoring_custom_offers;
create trigger intensive_custom_offers_retire_commerce_item
before delete on public.intensive_mentoring_custom_offers
for each row execute function public.retire_intensive_custom_offer_commerce_item();

insert into public.commerce_items(id,item_kind,is_available,created_at,updated_at)
select id,'intensive_mentoring_custom_offer',status='active',created_at,updated_at
from public.intensive_mentoring_custom_offers
on conflict(id) do update set item_kind=excluded.item_kind,is_available=excluded.is_available,updated_at=excluded.updated_at;

-- Domain admin RPCs no longer contain obsolete activation blockers.
create or replace function public.admin_save_intensive_add_on(
  p_id uuid, p_name text, p_description text, p_price_amount bigint, p_terms_note text,
  p_sort_order integer, p_is_active boolean, p_features jsonb
) returns public.intensive_mentoring_add_ons
language plpgsql security definer set search_path='' as $$
declare
  v_row public.intensive_mentoring_add_ons;
  v_slug text;v_code text;v_feature jsonb;v_text text;v_sort integer:=0;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if btrim(coalesce(p_name,''))='' or btrim(coalesce(p_description,''))='' or p_sort_order<0 then
    raise exception 'VALIDATION: Nama, deskripsi, dan urutan wajib valid.' using errcode='P0001';
  end if;
  if jsonb_typeof(coalesce(p_features,'[]'::jsonb))<>'array' then
    raise exception 'VALIDATION: Format fitur Add-On tidak valid.' using errcode='P0001';
  end if;
  if p_id is null then
    v_slug:=trim(both '-' from regexp_replace(lower(btrim(p_name)),'[^a-z0-9]+','-','g'));
    v_code:=trim(both '_' from regexp_replace(upper(btrim(p_name)),'[^A-Z0-9]+','_','g'));
    if v_slug='' or v_code='' then raise exception 'VALIDATION: Nama belum menghasilkan identifier yang valid.' using errcode='P0001';end if;
    if exists(select 1 from public.intensive_mentoring_add_ons where slug=v_slug or code=v_code) then
      raise exception 'VALIDATION: Nama menghasilkan identifier yang sudah digunakan.' using errcode='P0001';
    end if;
    insert into public.intensive_mentoring_add_ons(code,slug,name,description,price_amount,terms_note,sort_order,is_active)
    values(v_code,v_slug,btrim(p_name),btrim(p_description),p_price_amount,nullif(btrim(coalesce(p_terms_note,'')),''),p_sort_order,coalesce(p_is_active,true))
    returning * into v_row;
  else
    update public.intensive_mentoring_add_ons
    set name=btrim(p_name),description=btrim(p_description),price_amount=p_price_amount,
        terms_note=nullif(btrim(coalesce(p_terms_note,'')),''),sort_order=p_sort_order,is_active=coalesce(p_is_active,true)
    where id=p_id returning * into v_row;
    if not found then raise exception 'VALIDATION: Add-On Intensive Mentoring tidak ditemukan.' using errcode='P0001';end if;
  end if;
  delete from public.intensive_mentoring_add_on_features where add_on_id=v_row.id;
  for v_feature in select value from jsonb_array_elements(coalesce(p_features,'[]'::jsonb)) loop
    v_text:=btrim(coalesce(v_feature->>'text',''));
    if v_text<>'' then
      v_sort:=v_sort+1;
      insert into public.intensive_mentoring_add_on_features(add_on_id,text,sort_order,is_active)
      values(v_row.id,v_text,v_sort,true);
    end if;
  end loop;
  return v_row;
end; $$;

create or replace function public.admin_save_intensive_bundle(
  p_id uuid,p_name text,p_description text,p_price_amount bigint,p_badge_text text,
  p_sort_order integer,p_is_active boolean,p_items jsonb
) returns public.intensive_mentoring_bundles
language plpgsql security definer set search_path='' as $$
declare
  v_row public.intensive_mentoring_bundles;v_slug text;v_code text;v_item jsonb;v_type text;v_ref uuid;v_text text;v_sort integer:=0;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501';end if;
  if btrim(coalesce(p_name,''))='' or btrim(coalesce(p_description,''))='' or p_sort_order<0 then
    raise exception 'VALIDATION: Nama, deskripsi, dan urutan wajib valid.' using errcode='P0001';
  end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' then raise exception 'VALIDATION: Format isi bundle tidak valid.' using errcode='P0001';end if;
  if p_id is null then
    v_slug:=trim(both '-' from regexp_replace(lower(btrim(p_name)),'[^a-z0-9]+','-','g'));
    v_code:=trim(both '_' from regexp_replace(upper(btrim(p_name)),'[^A-Z0-9]+','_','g'));
    if v_slug='' or v_code='' then raise exception 'VALIDATION: Nama belum menghasilkan identifier yang valid.' using errcode='P0001';end if;
    if exists(select 1 from public.intensive_mentoring_bundles where slug=v_slug or code=v_code) then raise exception 'VALIDATION: Nama menghasilkan identifier yang sudah digunakan.' using errcode='P0001';end if;
    insert into public.intensive_mentoring_bundles(code,slug,name,description,price_amount,badge_text,sort_order,is_active)
    values(v_code,v_slug,btrim(p_name),btrim(p_description),p_price_amount,nullif(btrim(coalesce(p_badge_text,'')),''),p_sort_order,coalesce(p_is_active,true))
    returning * into v_row;
  else
    update public.intensive_mentoring_bundles
    set name=btrim(p_name),description=btrim(p_description),price_amount=p_price_amount,
        badge_text=nullif(btrim(coalesce(p_badge_text,'')),''),sort_order=p_sort_order,is_active=coalesce(p_is_active,true)
    where id=p_id returning * into v_row;
    if not found then raise exception 'VALIDATION: Bundle Intensive Mentoring tidak ditemukan.' using errcode='P0001';end if;
  end if;
  delete from public.intensive_mentoring_bundle_items where bundle_id=v_row.id;
  for v_item in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    v_type:=coalesce(v_item->>'item_type','');v_sort:=v_sort+1;
    if v_type='package' then
      v_ref:=nullif(v_item->>'reference_id','')::uuid;
      if v_ref is null or not exists(select 1 from public.intensive_mentoring_packages where id=v_ref) then raise exception 'VALIDATION: Paket bundle tidak ditemukan.' using errcode='P0001';end if;
      if v_row.is_active and not exists(select 1 from public.intensive_mentoring_packages where id=v_ref and is_active) then raise exception 'VALIDATION: Bundle aktif hanya boleh merujuk paket aktif.' using errcode='P0001';end if;
      insert into public.intensive_mentoring_bundle_items(bundle_id,item_type,package_id,sort_order,is_active) values(v_row.id,'package',v_ref,v_sort,true);
    elsif v_type='add_on' then
      v_ref:=nullif(v_item->>'reference_id','')::uuid;
      if v_ref is null or not exists(select 1 from public.intensive_mentoring_add_ons where id=v_ref) then raise exception 'VALIDATION: Add-On bundle tidak ditemukan.' using errcode='P0001';end if;
      if v_row.is_active and not exists(select 1 from public.intensive_mentoring_add_ons where id=v_ref and is_active) then raise exception 'VALIDATION: Bundle aktif hanya boleh merujuk Add-On aktif.' using errcode='P0001';end if;
      insert into public.intensive_mentoring_bundle_items(bundle_id,item_type,add_on_id,sort_order,is_active) values(v_row.id,'add_on',v_ref,v_sort,true);
    elsif v_type='feature' then
      v_text:=btrim(coalesce(v_item->>'text',''));
      if v_text='' then raise exception 'VALIDATION: Benefit teks bundle tidak boleh kosong.' using errcode='P0001';end if;
      insert into public.intensive_mentoring_bundle_items(bundle_id,item_type,feature_text,sort_order,is_active) values(v_row.id,'feature',v_text,v_sort,true);
    else
      raise exception 'VALIDATION: Jenis item bundle tidak didukung.' using errcode='P0001';
    end if;
  end loop;
  return v_row;
end; $$;

create or replace function public.admin_save_intensive_custom_offer(
  p_id uuid,p_mentee_id uuid,p_competition_category_id uuid,p_competition_name text,
  p_baseline_sessions_per_month integer,p_final_price_amount bigint,p_expires_at timestamptz,
  p_add_on_ids uuid[] default '{}'::uuid[],p_benefits text[] default '{}'::text[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_offer public.intensive_mentoring_custom_offers;v_name text:=btrim(coalesce(p_competition_name,''));v_id uuid;v_add_on uuid;v_benefit text;v_sort integer:=0;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if not exists(select 1 from public.profiles p join public.mentee_profiles mp on mp.user_id=p.id and mp.onboarding_completed_at is not null where p.id=p_mentee_id and p.role='mentee'::public.app_role) then raise exception 'Completed mentee account required' using errcode='22023';end if;
 if char_length(v_name)<2 or char_length(v_name)>300 then raise exception 'Competition name must be 2-300 characters' using errcode='22023';end if;
 if p_competition_category_id is not null and not exists(select 1 from public.competition_categories c where c.id=p_competition_category_id and c.is_active) then raise exception 'Active competition category required' using errcode='22023';end if;
 if p_baseline_sessions_per_month is not null and p_baseline_sessions_per_month not between 1 and 100 then raise exception 'Baseline must be between 1 and 100 sessions per month' using errcode='22023';end if;
 if p_final_price_amount is null or p_final_price_amount<1 or p_final_price_amount>9007199254740991 then raise exception 'Negotiated price must be a safe positive integer Rupiah amount' using errcode='22023';end if;
 if p_expires_at is not null and p_expires_at<=now() then raise exception 'Offer expiry must be in the future' using errcode='22023';end if;
 if cardinality(coalesce(p_add_on_ids,'{}'::uuid[]))<>cardinality(array(select distinct x from unnest(coalesce(p_add_on_ids,'{}'::uuid[]))x)) then raise exception 'Included add-ons cannot be duplicated' using errcode='22023';end if;
 if exists(select 1 from unnest(coalesce(p_add_on_ids,'{}'::uuid[]))x left join public.intensive_mentoring_add_ons a on a.id=x where a.id is null or not a.is_active) then raise exception 'Only active Intensive add-ons can be included' using errcode='22023';end if;

 if p_id is null then
   insert into public.intensive_mentoring_custom_offers(intended_mentee_id,title,competition_category_id,competition_name,baseline_sessions_per_month,final_price_amount,status,expires_at,created_by)
   values(p_mentee_id,'International Competition · '||v_name,p_competition_category_id,v_name,p_baseline_sessions_per_month,p_final_price_amount,'active',p_expires_at,auth.uid())
   returning id into v_id;
 else
   select * into v_offer from public.intensive_mentoring_custom_offers where id=p_id for update;
   if not found then raise exception 'International custom offer not found' using errcode='22023';end if;
   if v_offer.status not in('draft','active') then raise exception 'Converted or closed offers are commercially locked' using errcode='23514';end if;
   update public.intensive_mentoring_custom_offers
   set intended_mentee_id=p_mentee_id,title='International Competition · '||v_name,competition_category_id=p_competition_category_id,
       competition_name=v_name,baseline_sessions_per_month=p_baseline_sessions_per_month,final_price_amount=p_final_price_amount,
       status='active',expires_at=p_expires_at
   where id=p_id returning id into v_id;
   delete from public.intensive_mentoring_custom_offer_items where offer_id=v_id;
 end if;

 foreach v_add_on in array coalesce(p_add_on_ids,'{}'::uuid[]) loop
   v_sort:=v_sort+10;
   insert into public.intensive_mentoring_custom_offer_items(offer_id,item_type,add_on_id,sort_order)
   values(v_id,'add_on',v_add_on,v_sort);
 end loop;
 foreach v_benefit in array coalesce(p_benefits,'{}'::text[]) loop
   v_benefit:=btrim(coalesce(v_benefit,''));
   if v_benefit<>'' then
     if char_length(v_benefit)>500 then raise exception 'Custom benefit must be at most 500 characters' using errcode='22023';end if;
     v_sort:=v_sort+10;
     insert into public.intensive_mentoring_custom_offer_items(offer_id,item_type,benefit_text,sort_order)
     values(v_id,'benefit',v_benefit,v_sort);
   end if;
 end loop;
 return v_id;
end; $$;

create or replace function public.list_admin_intensive_custom_offers()
returns table(
 offer_id uuid,intended_mentee_id uuid,mentee_name text,mentee_email text,title text,
 competition_category_id uuid,competition_category_name text,competition_name text,
 baseline_sessions_per_month integer,final_price_amount bigint,status text,expires_at timestamptz,
 created_at timestamptz,updated_at timestamptz,included_add_ons jsonb,benefits jsonb
) language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 return query
 select o.id,o.intended_mentee_id,nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),'')::text,coalesce(u.email,'')::text,o.title,
        o.competition_category_id,c.name::text,o.competition_name,o.baseline_sessions_per_month,o.final_price_amount,
        (case when o.status='active' and o.expires_at is not null and o.expires_at<=now() then 'expired' else o.status end)::text,
        o.expires_at,o.created_at,o.updated_at,
        coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'code',a.code) order by i.sort_order,i.id)
                  from public.intensive_mentoring_custom_offer_items i join public.intensive_mentoring_add_ons a on a.id=i.add_on_id
                  where i.offer_id=o.id and i.item_type='add_on'),'[]'::jsonb),
        coalesce((select jsonb_agg(i.benefit_text order by i.sort_order,i.id)
                  from public.intensive_mentoring_custom_offer_items i
                  where i.offer_id=o.id and i.item_type='benefit'),'[]'::jsonb)
 from public.intensive_mentoring_custom_offers o
 join public.profiles p on p.id=o.intended_mentee_id
 join auth.users u on u.id=o.intended_mentee_id
 left join public.competition_categories c on c.id=o.competition_category_id
 order by o.created_at desc,o.id;
end; $$;

-- Shared Commerce resolves the negotiated value from the offer source, never from Cart Link input.
create or replace function public.resolve_commerce_item(p_commerce_item_id uuid)
returns table(commerce_item_id uuid,item_kind text,name text,slug text,description text,image_path text,price_amount bigint,is_available boolean)
language sql stable security definer set search_path='' as $$
  select ci.id,ci.item_kind,dp.name,dp.slug,dp.description,dp.image_path,dp.price_amount,(ci.is_available and dp.id is not null)
  from public.commerce_items ci left join public.digital_products dp on dp.id=ci.id
  where ci.id=p_commerce_item_id and ci.item_kind='digital_product'
  union all
  select ci.id,ci.item_kind,
    'Private Mentoring - '||t.name||' - '||p.session_count||case when p.session_count=1 then ' Session' else ' Sessions' end,
    'private-mentoring-'||lower(replace(t.code,'_','-'))||'-'||p.session_count||case when p.session_count=1 then '-session' else '-sessions' end,
    'Private Mentoring package'::text,null::text,p.price_amount,(ci.is_available and p.is_active and t.is_active)
  from public.commerce_items ci join public.private_mentoring_packages p on p.id=ci.id join public.mentor_tiers t on t.id=p.mentor_tier_id
  where ci.id=p_commerce_item_id and ci.item_kind='private_mentoring'
  union all
  select ci.id,ci.item_kind,p.name,p.slug,p.description,null::text,p.price_amount,
    (ci.is_available and p.is_active and p.pricing_mode='fixed' and p.price_amount is not null)
  from public.commerce_items ci join public.intensive_mentoring_packages p on p.id=ci.id
  where ci.id=p_commerce_item_id and ci.item_kind='intensive_mentoring_package'
  union all
  select ci.id,ci.item_kind,a.name,a.slug,a.description,null::text,a.price_amount,(ci.is_available and a.is_active)
  from public.commerce_items ci join public.intensive_mentoring_add_ons a on a.id=ci.id
  where ci.id=p_commerce_item_id and ci.item_kind='intensive_mentoring_add_on'
  union all
  select ci.id,ci.item_kind,b.name,b.slug,b.description,null::text,b.price_amount,
    (ci.is_available and b.is_active and not exists(
      select 1 from public.intensive_mentoring_bundle_items bi
      left join public.intensive_mentoring_packages bp on bp.id=bi.package_id
      left join public.intensive_mentoring_add_ons ba on ba.id=bi.add_on_id
      where bi.bundle_id=b.id and bi.is_active and(
        (bi.item_type='package' and(bp.id is null or not bp.is_active or bp.pricing_mode<>'fixed'))
        or(bi.item_type='add_on' and(ba.id is null or not ba.is_active))
      )
    ))
  from public.commerce_items ci join public.intensive_mentoring_bundles b on b.id=ci.id
  where ci.id=p_commerce_item_id and ci.item_kind='intensive_mentoring_bundle'
  union all
  select ci.id,ci.item_kind,o.title,('intensive-international-offer-'||o.id::text)::text,
    ('Custom Intensive Mentoring offer · '||o.competition_name)::text,null::text,o.final_price_amount,
    (ci.is_available and o.status='active' and(o.expires_at is null or o.expires_at>now()))
  from public.commerce_items ci join public.intensive_mentoring_custom_offers o on o.id=ci.id
  where ci.id=p_commerce_item_id and ci.item_kind='intensive_mentoring_custom_offer';
$$;

create or replace function public.list_admin_cart_link_items(p_mentee_id uuid,p_query text default '')
returns table(commerce_item_id uuid,item_kind text,name text,slug text,price_amount bigint,description text,image_path text,owned_by_mentee boolean,family_label text,session_count integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then return;end if;
 return query
 select r.commerce_item_id,r.item_kind,r.name,r.slug,r.price_amount,r.description,r.image_path,
   (r.item_kind='digital_product' and exists(select 1 from public.order_items oi join public.orders o on o.id=oi.order_id where o.user_id=p_mentee_id and o.status='paid' and oi.commerce_item_id=r.commerce_item_id and oi.item_kind_snapshot='digital_product')),
   case when r.item_kind='private_mentoring' then tier.name
        when r.item_kind='intensive_mentoring_custom_offer' then 'Penawaran Internasional'
        when r.item_kind like 'intensive_mentoring_%' then 'Intensive Mentoring'
        when r.item_kind='digital_product' then 'Produk Digital' else 'Lainnya' end::text,
   pm.session_count
 from public.commerce_items ci
 cross join lateral public.resolve_commerce_item(ci.id) r
 left join public.private_mentoring_packages pm on pm.id=ci.id and ci.item_kind='private_mentoring'
 left join public.mentor_tiers tier on tier.id=pm.mentor_tier_id
 left join public.intensive_mentoring_custom_offers offer on offer.id=ci.id and ci.item_kind='intensive_mentoring_custom_offer'
 where r.is_available
   and(r.item_kind<>'intensive_mentoring_custom_offer' or offer.intended_mentee_id=p_mentee_id)
   and(coalesce(p_query,'')='' or lower(concat_ws(' ',r.name,r.slug,r.item_kind)) like '%'||lower(p_query)||'%')
 order by 2,9,10 nulls last,3;
end; $$;

create or replace function public.create_commerce_cart_link_with_context(
 p_mentee_id uuid,p_token_hash text,p_commerce_item_ids uuid[],
 p_competition_category_id uuid default null,p_competition_name text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_link_id uuid;v_name text:=nullif(btrim(coalesce(p_competition_name,'')),'');v_item_id uuid;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if p_competition_category_id is not null and not exists(select 1 from public.competition_categories c where c.id=p_competition_category_id and c.is_active) then raise exception 'Active competition category required' using errcode='22023';end if;
 if v_name is not null and(char_length(v_name)<2 or char_length(v_name)>300) then raise exception 'Competition / bidang lomba must be 2-300 characters' using errcode='22023';end if;
 if(p_competition_category_id is not null or v_name is not null) and not exists(select 1 from public.commerce_items ci where ci.id=any(p_commerce_item_ids) and ci.item_kind='private_mentoring') then raise exception 'Competition prefill only applies to Private Mentoring items' using errcode='22023';end if;
 foreach v_item_id in array p_commerce_item_ids loop
   if exists(select 1 from public.intensive_mentoring_custom_offers o where o.id=v_item_id and o.intended_mentee_id is distinct from p_mentee_id) then
     raise exception 'International custom offer belongs to another mentee' using errcode='42501';
   end if;
 end loop;
 v_link_id:=public.create_commerce_cart_link(p_mentee_id,p_token_hash,p_commerce_item_ids);
 update public.commerce_cart_links set private_competition_category_id=p_competition_category_id,private_competition_name=v_name where id=v_link_id;
 return v_link_id;
end; $$;

create or replace function public.add_cart_item(p_commerce_item_id uuid) returns public.cart_items
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=public.current_completed_mentee_id();v_cart public.carts;v_item record;v_cart_item public.cart_items;
begin
 select * into v_item from public.resolve_commerce_item(p_commerce_item_id);
 if not found or v_item.is_available is distinct from true or v_item.name is null or v_item.price_amount is null then raise exception 'Commerce Item is unavailable' using errcode='22023';end if;
 if v_item.item_kind='intensive_mentoring_custom_offer' and not exists(select 1 from public.intensive_mentoring_custom_offers o where o.id=p_commerce_item_id and o.intended_mentee_id=v_uid) then raise exception 'International custom offer belongs to another mentee' using errcode='42501';end if;
 if v_item.item_kind='digital_product' and exists(select 1 from public.orders o join public.order_items oi on oi.order_id=o.id where o.user_id=v_uid and o.status='paid' and oi.commerce_item_id=p_commerce_item_id and oi.item_kind_snapshot='digital_product') then raise exception 'Digital Product is already owned' using errcode='22023';end if;
 v_cart:=public.get_or_create_active_cart();
 if exists(select 1 from public.cart_items ci where ci.cart_id=v_cart.id and ci.commerce_item_id=p_commerce_item_id) then raise exception 'Commerce Item is already in cart' using errcode='22023';end if;
 insert into public.cart_items(cart_id,commerce_item_id) values(v_cart.id,p_commerce_item_id) returning * into v_cart_item;
 return v_cart_item;
end; $$;

create or replace function public.claim_commerce_cart_link(p_token_hash text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=public.current_completed_mentee_id();v_link public.commerce_cart_links;v_cart public.carts;v_item record;
begin
 if p_token_hash is null or p_token_hash!~'^[0-9a-f]{64}$' then raise exception 'Invalid Cart Link' using errcode='22023';end if;
 select * into v_link from public.commerce_cart_links where token_hash=p_token_hash for update;
 if not found or v_link.status='revoked' then raise exception 'Cart Link is invalid or unavailable' using errcode='22023';end if;
 if v_link.mentee_id is distinct from v_uid then raise exception 'Cart Link belongs to another mentee' using errcode='42501';end if;
 if v_link.status='claimed' then return v_link.claimed_cart_id;end if;
 for v_item in
   select li.commerce_item_id,ci.item_kind,r.is_available,r.price_amount
   from public.commerce_cart_link_items li join public.commerce_items ci on ci.id=li.commerce_item_id
   left join lateral public.resolve_commerce_item(li.commerce_item_id)r on true where li.cart_link_id=v_link.id
 loop
   if v_item.is_available is distinct from true or v_item.price_amount is null then raise exception 'Cart Link contains an unavailable item' using errcode='22023';end if;
   if v_item.item_kind='intensive_mentoring_custom_offer' and not exists(select 1 from public.intensive_mentoring_custom_offers o where o.id=v_item.commerce_item_id and o.intended_mentee_id=v_uid) then raise exception 'International custom offer belongs to another mentee' using errcode='42501';end if;
   if v_item.item_kind='digital_product' and exists(select 1 from public.order_items oi join public.orders o on o.id=oi.order_id where o.user_id=v_uid and o.status='paid' and oi.commerce_item_id=v_item.commerce_item_id and oi.item_kind_snapshot='digital_product') then raise exception 'Cart Link contains a digital product already owned by this mentee' using errcode='23505';end if;
 end loop;
 v_cart:=public.get_or_create_active_cart();
 insert into public.cart_items(cart_id,commerce_item_id)
 select v_cart.id,li.commerce_item_id from public.commerce_cart_link_items li where li.cart_link_id=v_link.id
 on conflict(cart_id,commerce_item_id) do nothing;
 update public.commerce_cart_links set status='claimed',claimed_cart_id=v_cart.id,claimed_at=now() where id=v_link.id;
 return v_cart.id;
end; $$;

create or replace function public.create_order_from_cart(p_cart_id uuid) returns public.orders
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=public.current_completed_mentee_id();v_cart public.carts;v_order public.orders;v_item_count integer;v_total bigint;
begin
 if p_cart_id is null then raise exception 'Cart identity is required' using errcode='22023';end if;
 select * into v_cart from public.carts where id=p_cart_id and user_id=v_uid for update;
 if not found then raise exception 'Cart not found' using errcode='42501';end if;
 select * into v_order from public.orders where cart_id=v_cart.id and user_id=v_uid;
 if found then return v_order;end if;
 if v_cart.status<>'active' then raise exception 'Cart is not active' using errcode='22023';end if;
 perform 1 from public.cart_items where cart_id=v_cart.id for update;
 select count(*) into v_item_count from public.cart_items where cart_id=v_cart.id;
 if v_item_count=0 then raise exception 'Cart is empty' using errcode='22023';end if;
 if exists(select 1 from public.cart_items ci cross join lateral public.resolve_commerce_item(ci.commerce_item_id)r where ci.cart_id=v_cart.id and(r.is_available is distinct from true or r.name is null or r.slug is null or r.price_amount is null)) then raise exception 'Cart contains an unavailable item' using errcode='22023';end if;
 if exists(select 1 from public.cart_items ci join public.commerce_items registry on registry.id=ci.commerce_item_id join public.intensive_mentoring_custom_offers o on o.id=registry.id and registry.item_kind='intensive_mentoring_custom_offer' where ci.cart_id=v_cart.id and o.intended_mentee_id is distinct from v_uid) then raise exception 'Cart contains an International custom offer for another mentee' using errcode='42501';end if;
 if exists(select 1 from public.cart_items ci cross join lateral public.resolve_commerce_item(ci.commerce_item_id)r where ci.cart_id=v_cart.id and r.item_kind='digital_product' and exists(select 1 from public.orders owned_order join public.order_items owned_item on owned_item.order_id=owned_order.id where owned_order.user_id=v_uid and owned_order.status='paid' and owned_item.commerce_item_id=ci.commerce_item_id and owned_item.item_kind_snapshot='digital_product')) then raise exception 'Cart contains an already-owned Digital Product' using errcode='22023';end if;
 select coalesce(sum(r.price_amount),0)::bigint into v_total from public.cart_items ci cross join lateral public.resolve_commerce_item(ci.commerce_item_id)r where ci.cart_id=v_cart.id;
 insert into public.orders(user_id,cart_id,total_amount) values(v_uid,v_cart.id,v_total) returning * into v_order;
 insert into public.order_items(order_id,commerce_item_id,item_kind_snapshot,name_snapshot,slug_snapshot,unit_price_amount)
 select v_order.id,ci.commerce_item_id,r.item_kind,r.name,r.slug,r.price_amount
 from public.cart_items ci cross join lateral public.resolve_commerce_item(ci.commerce_item_id)r
 where ci.cart_id=v_cart.id order by ci.created_at,ci.id;
 update public.intensive_mentoring_custom_offers o set status='converted'
 where o.status='active' and exists(select 1 from public.order_items oi where oi.order_id=v_order.id and oi.commerce_item_id=o.id and oi.item_kind_snapshot='intensive_mentoring_custom_offer');
 update public.carts set status='converted' where id=v_cart.id;
 return v_order;
end; $$;

-- Extend normalized Intensive entitlement shape without coercing custom offers to a package/bundle.
alter table public.intensive_mentoring_entitlements
  add column if not exists custom_offer_id uuid references public.intensive_mentoring_custom_offers(id);

-- The original entitlement checks were unnamed, so PostgreSQL generated names that may
-- vary after partial/manual application. Drop matching definitions by catalog inspection.
do $repair_entitlement_checks$
declare v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid='public.intensive_mentoring_entitlements'::regclass
      and contype='c'
      and (
        pg_get_constraintdef(oid) ilike '%entitlement_kind%'
        or (
          pg_get_constraintdef(oid) ilike '%package_id%'
          and pg_get_constraintdef(oid) ilike '%bundle_id%'
          and pg_get_constraintdef(oid) ilike '%add_on_id%'
        )
      )
  loop
    execute format('alter table public.intensive_mentoring_entitlements drop constraint %I',v_constraint.conname);
  end loop;
end
$repair_entitlement_checks$;

alter table public.intensive_mentoring_entitlements
  add constraint intensive_mentoring_entitlements_entitlement_kind_check
  check(entitlement_kind in('package','bundle','add_on','custom_offer'));
alter table public.intensive_mentoring_entitlements
  add constraint intensive_mentoring_entitlements_shape_check
  check(
    (entitlement_kind='package' and package_id is not null and bundle_id is null and add_on_id is null and custom_offer_id is null)
    or(entitlement_kind='bundle' and package_id is null and bundle_id is not null and add_on_id is null and custom_offer_id is null)
    or(entitlement_kind='add_on' and package_id is null and bundle_id is null and add_on_id is not null and custom_offer_id is null)
    or(entitlement_kind='custom_offer' and package_id is null and bundle_id is null and add_on_id is null and custom_offer_id is not null)
  );

create or replace function public.reconcile_intensive_order_entitlements(p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_count integer;v_engagement uuid;
begin
 insert into public.intensive_mentoring_engagements(mentee_id,base_entitlement_id,baseline_sessions_per_month,competition_category_id,competition_name,created_at,started_at)
 select e.mentee_id,e.id,e.purchased_sessions,o.competition_category_id,o.competition_name,e.created_at,e.created_at
 from public.intensive_mentoring_entitlements e
 join public.order_items oi on oi.id=e.order_item_id
 left join public.intensive_mentoring_custom_offers o on o.id=e.custom_offer_id
 where oi.order_id=p_order_id and e.entitlement_kind in('package','bundle','custom_offer')
 on conflict(base_entitlement_id) do nothing;

 update public.intensive_mentoring_entitlements e set engagement_id=g.id
 from public.intensive_mentoring_engagements g,public.order_items oi
 where oi.id=e.order_item_id and oi.order_id=p_order_id and g.base_entitlement_id=e.id
 and e.entitlement_kind in('package','bundle','custom_offer') and e.engagement_id is distinct from g.id;

 select count(distinct e.engagement_id),(array_agg(distinct e.engagement_id))[1] into v_count,v_engagement
 from public.intensive_mentoring_entitlements e join public.order_items oi on oi.id=e.order_item_id
 where oi.order_id=p_order_id and e.entitlement_kind in('package','bundle','custom_offer') and e.engagement_id is not null;

 if v_count=1 then
  with changed as(
   update public.intensive_mentoring_entitlements e set engagement_id=v_engagement
   from public.order_items oi
   where oi.id=e.order_item_id and oi.order_id=p_order_id and e.entitlement_kind='add_on' and e.engagement_id is null
   returning e.id,e.engagement_id
  )
  insert into public.intensive_mentoring_entitlement_attachment_events(entitlement_id,engagement_id,event_type,note)
  select id,engagement_id,'auto_attached','Same paid order has exactly one base Intensive engagement.' from changed;
 end if;
end; $$;

create or replace function public.fulfill_paid_intensive_mentoring_order(p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_order public.orders;v_item public.order_items;v_sessions integer;v_offer public.intensive_mentoring_custom_offers;
begin
 select * into v_order from public.orders where id=p_order_id;
 if not found or v_order.status<>'paid' then return;end if;
 for v_item in select * from public.order_items where order_id=p_order_id and item_kind_snapshot in('intensive_mentoring_package','intensive_mentoring_bundle','intensive_mentoring_add_on','intensive_mentoring_custom_offer') loop
  v_sessions:=null;
  if v_item.item_kind_snapshot='intensive_mentoring_package' then
   select sessions_per_month into v_sessions from public.intensive_mentoring_packages where id=v_item.commerce_item_id;
   if not found then raise exception 'Paid Intensive Mentoring package is missing' using errcode='23503';end if;
   insert into public.intensive_mentoring_entitlements(mentee_id,order_item_id,entitlement_kind,package_id,purchased_sessions)
   values(v_order.user_id,v_item.id,'package',v_item.commerce_item_id,v_sessions) on conflict(order_item_id) do nothing;
  elsif v_item.item_kind_snapshot='intensive_mentoring_bundle' then
   select max(p.sessions_per_month) into v_sessions from public.intensive_mentoring_bundle_items bi join public.intensive_mentoring_packages p on p.id=bi.package_id where bi.bundle_id=v_item.commerce_item_id and bi.item_type='package' and bi.is_active;
   if not exists(select 1 from public.intensive_mentoring_bundles where id=v_item.commerce_item_id) then raise exception 'Paid Intensive Mentoring bundle is missing' using errcode='23503';end if;
   insert into public.intensive_mentoring_entitlements(mentee_id,order_item_id,entitlement_kind,bundle_id,purchased_sessions)
   values(v_order.user_id,v_item.id,'bundle',v_item.commerce_item_id,v_sessions) on conflict(order_item_id) do nothing;
  elsif v_item.item_kind_snapshot='intensive_mentoring_custom_offer' then
   select * into v_offer from public.intensive_mentoring_custom_offers where id=v_item.commerce_item_id for update;
   if not found then raise exception 'Paid International Intensive custom offer is missing' using errcode='23503';end if;
   if v_offer.intended_mentee_id is distinct from v_order.user_id then raise exception 'Paid International custom offer recipient mismatch' using errcode='42501';end if;
   insert into public.intensive_mentoring_entitlements(mentee_id,order_item_id,entitlement_kind,custom_offer_id,purchased_sessions)
   values(v_order.user_id,v_item.id,'custom_offer',v_item.commerce_item_id,v_offer.baseline_sessions_per_month) on conflict(order_item_id) do nothing;
   update public.intensive_mentoring_custom_offers set status='purchased' where id=v_offer.id and status in('active','converted');
  else
   if not exists(select 1 from public.intensive_mentoring_add_ons where id=v_item.commerce_item_id) then raise exception 'Paid Intensive Mentoring add-on is missing' using errcode='23503';end if;
   insert into public.intensive_mentoring_entitlements(mentee_id,order_item_id,entitlement_kind,add_on_id)
   values(v_order.user_id,v_item.id,'add_on',v_item.commerce_item_id) on conflict(order_item_id) do nothing;
  end if;
 end loop;
 perform public.reconcile_intensive_order_entitlements(p_order_id);
end; $$;

create or replace function public.intensive_engagement_add_ons_json(p_engagement_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'entitlementId',x.entitlement_id,'name',x.name,'code',x.code,'status',x.status,'source',x.source,'supportType',x.support_type
 ) order by x.sort_order,x.name),'[]'::jsonb)
 from(
   select a.id entitlement_id,ao.name,ao.code,a.status::text status,'attached'::text source,'add_on'::text support_type,1000+ao.sort_order sort_order,ao.id add_on_id
   from public.intensive_mentoring_entitlements a join public.intensive_mentoring_add_ons ao on ao.id=a.add_on_id
   where a.engagement_id=p_engagement_id and a.entitlement_kind='add_on'
   union all
   select null::uuid,ao.name,ao.code,'included'::text,'bundle'::text,'add_on'::text,ao.sort_order,ao.id
   from public.intensive_mentoring_engagements g
   join public.intensive_mentoring_entitlements base on base.id=g.base_entitlement_id and base.entitlement_kind='bundle'
   join public.intensive_mentoring_bundle_items bi on bi.bundle_id=base.bundle_id and bi.item_type='add_on' and bi.is_active
   join public.intensive_mentoring_add_ons ao on ao.id=bi.add_on_id
   where g.id=p_engagement_id and not exists(select 1 from public.intensive_mentoring_entitlements attached where attached.engagement_id=g.id and attached.entitlement_kind='add_on' and attached.add_on_id=ao.id)
   union all
   select null::uuid,ao.name,ao.code,'included'::text,'custom_offer'::text,'add_on'::text,i.sort_order,ao.id
   from public.intensive_mentoring_engagements g
   join public.intensive_mentoring_entitlements base on base.id=g.base_entitlement_id and base.entitlement_kind='custom_offer'
   join public.intensive_mentoring_custom_offer_items i on i.offer_id=base.custom_offer_id and i.item_type='add_on'
   join public.intensive_mentoring_add_ons ao on ao.id=i.add_on_id
   where g.id=p_engagement_id
   union all
   select null::uuid,i.benefit_text,('CUSTOM_BENEFIT_'||i.id::text)::text,'included'::text,'custom_offer'::text,'benefit'::text,5000+i.sort_order,null::uuid
   from public.intensive_mentoring_engagements g
   join public.intensive_mentoring_entitlements base on base.id=g.base_entitlement_id and base.entitlement_kind='custom_offer'
   join public.intensive_mentoring_custom_offer_items i on i.offer_id=base.custom_offer_id and i.item_type='benefit'
   where g.id=p_engagement_id
 )x;
$$;

-- Preserve old 3-argument callers and add explicit current activity for new clients.
create or replace function public.admin_set_intensive_program_stage(p_engagement_id uuid,p_stage text,p_progress_summary text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if p_stage not in('goal_setting','initial_assessment','guided_development','practice_application','review_refinement','final_evaluation') then raise exception 'Invalid program stage' using errcode='22023';end if;
 update public.intensive_mentoring_engagements set program_stage=p_stage,progress_summary=nullif(btrim(coalesce(p_progress_summary,'')),'') where id=p_engagement_id;
 if not found then raise exception 'Intensive engagement not found' using errcode='22023';end if;
end; $$;
create or replace function public.admin_set_intensive_program_stage(p_engagement_id uuid,p_stage text,p_progress_summary text,p_current_activity text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if p_stage not in('goal_setting','initial_assessment','guided_development','practice_application','review_refinement','final_evaluation') then raise exception 'Invalid program stage' using errcode='22023';end if;
 if char_length(btrim(coalesce(p_current_activity,'')))>500 then raise exception 'Current activity must be at most 500 characters' using errcode='22023';end if;
 update public.intensive_mentoring_engagements set program_stage=p_stage,current_activity=nullif(btrim(coalesce(p_current_activity,'')),''),progress_summary=nullif(btrim(coalesce(p_progress_summary,'')),'') where id=p_engagement_id;
 if not found then raise exception 'Intensive engagement not found' using errcode='22023';end if;
 insert into public.intensive_mentoring_engagement_events(engagement_id,event_type,actor_user_id,metadata)
 values(p_engagement_id,'program_progress_updated',auth.uid(),jsonb_build_object('programStage',p_stage,'currentActivity',nullif(btrim(coalesce(p_current_activity,'')),''),'progressSummary',nullif(btrim(coalesce(p_progress_summary,'')),''));
end; $$;

drop function if exists public.list_my_intensive_mentoring_engagements();
create function public.list_my_intensive_mentoring_engagements()
returns table(
 engagement_id uuid,base_entitlement_id uuid,base_kind text,program_name text,status text,baseline_sessions_per_month integer,
 primary_mentor_id uuid,primary_mentor_name text,competition_name text,program_stage text,current_activity text,progress_summary text,started_at timestamptz,
 add_ons jsonb,sessions jsonb
) language sql stable security definer set search_path='' as $$
 select g.id,g.base_entitlement_id,e.entitlement_kind,coalesce(p.name,b.name,o.title)::text,g.status,g.baseline_sessions_per_month,g.primary_mentor_id,
 nullif(btrim(concat_ws(' ',mentor.first_name,mentor.last_name)),'')::text,g.competition_name,g.program_stage,g.current_activity,g.progress_summary,g.started_at,
 public.intensive_engagement_add_ons_json(g.id),
 coalesce((select jsonb_agg(jsonb_build_object('sessionId',s.id,'sessionNumber',s.session_number,'durationMinutes',s.duration_minutes,'status',s.status,'focusId',s.session_focus_id,'focusName',f.name,'menteeTopicRequest',s.mentee_topic_request,'topicStatus',s.topic_status,'resolvedTopic',s.resolved_topic,'mentorId',s.mentor_id,'mentorName',nullif(btrim(concat_ws(' ',sm.first_name,sm.last_name)),''),'scheduledStartAt',s.scheduled_start_at,'scheduledEndAt',s.scheduled_end_at,'meetingUrl',case when s.status='scheduled' then coalesce(ci.manual_meeting_url,ci.provider_meeting_url) end,'googleSyncStatus',coalesce(ci.sync_status,'pending'),'recordingStatus',coalesce(ci.recording_status,'expected'),'creationSource',s.creation_source) order by s.session_number) from public.intensive_mentoring_sessions s left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id left join public.profiles sm on sm.id=s.mentor_id left join public.intensive_mentoring_session_calendar_integrations ci on ci.session_id=s.id where s.engagement_id=g.id),'[]'::jsonb)
 from public.intensive_mentoring_engagements g join public.intensive_mentoring_entitlements e on e.id=g.base_entitlement_id
 left join public.intensive_mentoring_packages p on p.id=e.package_id left join public.intensive_mentoring_bundles b on b.id=e.bundle_id
 left join public.intensive_mentoring_custom_offers o on o.id=e.custom_offer_id left join public.profiles mentor on mentor.id=g.primary_mentor_id
 where g.mentee_id=auth.uid() order by g.created_at desc,g.id;
$$;

drop function if exists public.list_admin_intensive_mentoring_engagements();
create function public.list_admin_intensive_mentoring_engagements()
returns table(
 engagement_id uuid,mentee_id uuid,mentee_name text,mentee_email text,base_entitlement_id uuid,base_kind text,program_name text,status text,
 baseline_sessions_per_month integer,primary_mentor_id uuid,primary_mentor_name text,program_stage text,current_activity text,progress_summary text,created_at timestamptz,
 add_ons jsonb,sessions jsonb,unassigned_add_ons jsonb
) language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 return query select g.id,g.mentee_id,nullif(btrim(concat_ws(' ',mp.first_name,mp.last_name)),''),coalesce(mu.email,'')::text,g.base_entitlement_id,e.entitlement_kind,coalesce(p.name,b.name,o.title)::text,g.status,g.baseline_sessions_per_month,g.primary_mentor_id,nullif(btrim(concat_ws(' ',mentor.first_name,mentor.last_name)),'')::text,g.program_stage,g.current_activity,g.progress_summary,g.created_at,
 public.intensive_engagement_add_ons_json(g.id),
 coalesce((select jsonb_agg(jsonb_build_object('sessionId',s.id,'sessionNumber',s.session_number,'durationMinutes',s.duration_minutes,'status',s.status,'focusId',s.session_focus_id,'focusName',f.name,'menteeTopicRequest',s.mentee_topic_request,'topicStatus',s.topic_status,'resolvedTopic',s.resolved_topic,'mentorId',s.mentor_id,'mentorName',nullif(btrim(concat_ws(' ',sm.first_name,sm.last_name)),''),'scheduledStartAt',s.scheduled_start_at,'scheduledEndAt',s.scheduled_end_at,'meetingUrl',case when s.status='scheduled' then coalesce(ci.manual_meeting_url,ci.provider_meeting_url) end,'providerSyncStatus',coalesce(ci.provider_sync_status,'pending'),'googleSyncStatus',coalesce(ci.sync_status,'pending'),'recordingStatus',coalesce(ci.recording_status,'expected'),'creationSource',s.creation_source,'creationReason',s.creation_reason) order by s.session_number) from public.intensive_mentoring_sessions s left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id left join public.profiles sm on sm.id=s.mentor_id left join public.intensive_mentoring_session_calendar_integrations ci on ci.session_id=s.id where s.engagement_id=g.id),'[]'::jsonb),
 coalesce((select jsonb_agg(jsonb_build_object('entitlementId',a.id,'name',ao.name,'code',ao.code,'createdAt',a.created_at) order by a.created_at,a.id) from public.intensive_mentoring_entitlements a join public.intensive_mentoring_add_ons ao on ao.id=a.add_on_id where a.mentee_id=g.mentee_id and a.entitlement_kind='add_on' and a.engagement_id is null),'[]'::jsonb)
 from public.intensive_mentoring_engagements g join public.intensive_mentoring_entitlements e on e.id=g.base_entitlement_id join public.profiles mp on mp.id=g.mentee_id join auth.users mu on mu.id=g.mentee_id
 left join public.intensive_mentoring_packages p on p.id=e.package_id left join public.intensive_mentoring_bundles b on b.id=e.bundle_id left join public.intensive_mentoring_custom_offers o on o.id=e.custom_offer_id
 left join public.profiles mentor on mentor.id=g.primary_mentor_id order by g.created_at desc,g.id;
end; $$;

create or replace function public.list_my_mentor_intensive_mentoring_sessions()
returns table(
 session_id uuid,engagement_id uuid,mentee_id uuid,mentee_name text,mentee_email text,program_name text,session_number integer,status text,focus_name text,resolved_topic text,
 scheduled_start_at timestamptz,scheduled_end_at timestamptz,mentor_timezone text,duration_minutes integer,meeting_url text,google_event_id text,google_ical_uid text,google_sync_status text,recording_status text,add_ons jsonb
) language sql stable security definer set search_path='' as $$
 select s.id,g.id,g.mentee_id,nullif(btrim(concat_ws(' ',mp.first_name,mp.last_name)),''),coalesce(mu.email,'')::text,coalesce(p.name,b.name,o.title)::text,s.session_number,s.status,f.name,s.resolved_topic,s.scheduled_start_at,s.scheduled_end_at,mentor_profile.timezone,s.duration_minutes,case when s.status='scheduled' then coalesce(ci.manual_meeting_url,ci.provider_meeting_url) end,ci.google_event_id,ci.google_ical_uid,coalesce(ci.sync_status,'pending'),coalesce(ci.recording_status,'expected'),public.intensive_engagement_add_ons_json(g.id)
 from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements g on g.id=s.engagement_id join public.intensive_mentoring_entitlements e on e.id=g.base_entitlement_id join public.profiles mp on mp.id=g.mentee_id join auth.users mu on mu.id=g.mentee_id join public.mentor_profiles mentor_profile on mentor_profile.user_id=s.mentor_id
 left join public.intensive_mentoring_packages p on p.id=e.package_id left join public.intensive_mentoring_bundles b on b.id=e.bundle_id left join public.intensive_mentoring_custom_offers o on o.id=e.custom_offer_id
 left join public.private_mentoring_session_focuses f on f.id=s.session_focus_id left join public.intensive_mentoring_session_calendar_integrations ci on ci.session_id=s.id
 where s.mentor_id=auth.uid() order by s.scheduled_start_at nulls last,s.session_number;
$$;

-- Policy convergence: the historical operations migration had 12 bare CREATE POLICY statements.
drop policy if exists intensive_engagement_owner_read on public.intensive_mentoring_engagements;
create policy intensive_engagement_owner_read on public.intensive_mentoring_engagements for select to authenticated using(mentee_id=auth.uid());
drop policy if exists intensive_engagement_admin_read on public.intensive_mentoring_engagements;
create policy intensive_engagement_admin_read on public.intensive_mentoring_engagements for select to authenticated using(public.is_admin());
drop policy if exists intensive_engagement_mentor_read on public.intensive_mentoring_engagements;
create policy intensive_engagement_mentor_read on public.intensive_mentoring_engagements for select to authenticated using(primary_mentor_id=auth.uid() or exists(select 1 from public.intensive_mentoring_sessions s where s.engagement_id=intensive_mentoring_engagements.id and s.mentor_id=auth.uid()));
drop policy if exists intensive_sessions_owner_read on public.intensive_mentoring_sessions;
create policy intensive_sessions_owner_read on public.intensive_mentoring_sessions for select to authenticated using(exists(select 1 from public.intensive_mentoring_engagements g where g.id=engagement_id and g.mentee_id=auth.uid()));
drop policy if exists intensive_sessions_admin_read on public.intensive_mentoring_sessions;
create policy intensive_sessions_admin_read on public.intensive_mentoring_sessions for select to authenticated using(public.is_admin());
drop policy if exists intensive_sessions_mentor_read on public.intensive_mentoring_sessions;
create policy intensive_sessions_mentor_read on public.intensive_mentoring_sessions for select to authenticated using(mentor_id=auth.uid());
drop policy if exists intensive_session_events_owner_read on public.intensive_mentoring_session_events;
create policy intensive_session_events_owner_read on public.intensive_mentoring_session_events for select to authenticated using(exists(select 1 from public.intensive_mentoring_sessions s join public.intensive_mentoring_engagements g on g.id=s.engagement_id where s.id=session_id and g.mentee_id=auth.uid()));
drop policy if exists intensive_session_events_admin_read on public.intensive_mentoring_session_events;
create policy intensive_session_events_admin_read on public.intensive_mentoring_session_events for select to authenticated using(public.is_admin());
drop policy if exists intensive_session_events_mentor_read on public.intensive_mentoring_session_events;
create policy intensive_session_events_mentor_read on public.intensive_mentoring_session_events for select to authenticated using(exists(select 1 from public.intensive_mentoring_sessions s where s.id=session_id and s.mentor_id=auth.uid()));
drop policy if exists intensive_engagement_events_owner_read on public.intensive_mentoring_engagement_events;
create policy intensive_engagement_events_owner_read on public.intensive_mentoring_engagement_events for select to authenticated using(exists(select 1 from public.intensive_mentoring_engagements g where g.id=engagement_id and g.mentee_id=auth.uid()));
drop policy if exists intensive_engagement_events_admin_read on public.intensive_mentoring_engagement_events;
create policy intensive_engagement_events_admin_read on public.intensive_mentoring_engagement_events for select to authenticated using(public.is_admin());
drop policy if exists intensive_engagement_events_mentor_read on public.intensive_mentoring_engagement_events;
create policy intensive_engagement_events_mentor_read on public.intensive_mentoring_engagement_events for select to authenticated using(exists(select 1 from public.intensive_mentoring_engagements g where g.id=engagement_id and(g.primary_mentor_id=auth.uid() or exists(select 1 from public.intensive_mentoring_sessions s where s.engagement_id=g.id and s.mentor_id=auth.uid()))));

revoke all on function public.admin_save_intensive_custom_offer(uuid,uuid,uuid,text,integer,bigint,timestamptz,uuid[],text[]),
 public.list_admin_intensive_custom_offers(),
 public.admin_set_intensive_program_stage(uuid,text,text,text)
from public,anon;
grant execute on function public.admin_save_intensive_custom_offer(uuid,uuid,uuid,text,integer,bigint,timestamptz,uuid[],text[]),
 public.list_admin_intensive_custom_offers(),
 public.admin_set_intensive_program_stage(uuid,text,text,text)
to authenticated,service_role;

revoke all on function public.intensive_engagement_add_ons_json(uuid) from public,anon,authenticated;
grant execute on function public.intensive_engagement_add_ons_json(uuid) to service_role;
revoke all on function public.list_my_intensive_mentoring_engagements(),public.list_admin_intensive_mentoring_engagements(),public.list_my_mentor_intensive_mentoring_sessions() from public,anon;
grant execute on function public.list_my_intensive_mentoring_engagements(),public.list_admin_intensive_mentoring_engagements(),public.list_my_mentor_intensive_mentoring_sessions() to authenticated,service_role;

comment on table public.intensive_mentoring_custom_offers is 'Intended-mentee International Intensive Mentoring offer. final_price_amount is the authoritative negotiated Shared Commerce price.';
comment on table public.intensive_mentoring_custom_offer_items is 'Normalized included Intensive add-ons and custom textual benefits for an International custom offer.';
