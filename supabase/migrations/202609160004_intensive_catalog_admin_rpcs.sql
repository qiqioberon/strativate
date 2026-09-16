-- Intensive catalog writes are transactional so parent fields and ordered child rows cannot drift apart.
create or replace function public.admin_save_intensive_package(
  p_id uuid, p_name text, p_description text, p_competition_scope text, p_sessions_per_month integer,
  p_pricing_mode text, p_price_amount bigint, p_reference_price_amount bigint, p_sort_order integer,
  p_is_active boolean, p_features jsonb
) returns public.intensive_mentoring_packages
language plpgsql security definer set search_path='' as $$
declare
  v_row public.intensive_mentoring_packages;
  v_slug text;
  v_code text;
  v_feature jsonb;
  v_text text;
  v_sort integer := 0;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if btrim(coalesce(p_name,''))='' or btrim(coalesce(p_description,''))='' or p_sort_order < 0 then
    raise exception 'VALIDATION: Nama, deskripsi, dan urutan wajib valid.' using errcode='P0001';
  end if;
  if jsonb_typeof(coalesce(p_features,'[]'::jsonb)) <> 'array' then
    raise exception 'VALIDATION: Format fitur paket tidak valid.' using errcode='P0001';
  end if;
  if p_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'));
    v_code := trim(both '_' from regexp_replace(upper(btrim(p_name)), '[^A-Z0-9]+', '_', 'g'));
    if v_slug='' or v_code='' then raise exception 'VALIDATION: Nama belum menghasilkan identifier yang valid.' using errcode='P0001'; end if;
    if exists(select 1 from public.intensive_mentoring_packages where slug=v_slug or code=v_code) then
      raise exception 'VALIDATION: Nama menghasilkan identifier yang sudah digunakan.' using errcode='P0001';
    end if;
    insert into public.intensive_mentoring_packages(code,slug,name,description,competition_scope,sessions_per_month,pricing_mode,price_amount,reference_price_amount,sort_order,is_active)
    values(v_code,v_slug,btrim(p_name),btrim(p_description),p_competition_scope,p_sessions_per_month,p_pricing_mode,p_price_amount,p_reference_price_amount,p_sort_order,coalesce(p_is_active,true)) returning * into v_row;
  else
    update public.intensive_mentoring_packages
    set name=btrim(p_name),description=btrim(p_description),competition_scope=p_competition_scope,sessions_per_month=p_sessions_per_month,
        pricing_mode=p_pricing_mode,price_amount=p_price_amount,reference_price_amount=p_reference_price_amount,sort_order=p_sort_order,is_active=coalesce(p_is_active,true)
    where id=p_id returning * into v_row;
    if not found then raise exception 'VALIDATION: Paket Intensive Mentoring tidak ditemukan.' using errcode='P0001'; end if;
  end if;
  delete from public.intensive_mentoring_package_features where package_id=v_row.id;
  for v_feature in select value from jsonb_array_elements(coalesce(p_features,'[]'::jsonb)) loop
    v_text := btrim(coalesce(v_feature->>'text',''));
    if v_text <> '' then
      v_sort := v_sort + 1;
      insert into public.intensive_mentoring_package_features(package_id,text,sort_order,is_active) values(v_row.id,v_text,v_sort,true);
    end if;
  end loop;
  return v_row;
end;
$$;

create or replace function public.admin_save_intensive_add_on(
  p_id uuid, p_name text, p_description text, p_price_amount bigint, p_terms_note text,
  p_sort_order integer, p_is_active boolean, p_features jsonb
) returns public.intensive_mentoring_add_ons
language plpgsql security definer set search_path='' as $$
declare
  v_row public.intensive_mentoring_add_ons;
  v_slug text;
  v_code text;
  v_feature jsonb;
  v_text text;
  v_sort integer := 0;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if btrim(coalesce(p_name,''))='' or btrim(coalesce(p_description,''))='' or p_sort_order < 0 then
    raise exception 'VALIDATION: Nama, deskripsi, dan urutan wajib valid.' using errcode='P0001';
  end if;
  if jsonb_typeof(coalesce(p_features,'[]'::jsonb)) <> 'array' then
    raise exception 'VALIDATION: Format fitur Add-On tidak valid.' using errcode='P0001';
  end if;
  if p_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'));
    v_code := trim(both '_' from regexp_replace(upper(btrim(p_name)), '[^A-Z0-9]+', '_', 'g'));
    if v_slug='' or v_code='' then raise exception 'VALIDATION: Nama belum menghasilkan identifier yang valid.' using errcode='P0001'; end if;
    if exists(select 1 from public.intensive_mentoring_add_ons where slug=v_slug or code=v_code) then
      raise exception 'VALIDATION: Nama menghasilkan identifier yang sudah digunakan.' using errcode='P0001';
    end if;
    insert into public.intensive_mentoring_add_ons(code,slug,name,description,price_amount,terms_note,sort_order,is_active)
    values(v_code,v_slug,btrim(p_name),btrim(p_description),p_price_amount,nullif(btrim(coalesce(p_terms_note,'')),''),p_sort_order,coalesce(p_is_active,true)) returning * into v_row;
  else
    update public.intensive_mentoring_add_ons
    set name=btrim(p_name),description=btrim(p_description),price_amount=p_price_amount,terms_note=nullif(btrim(coalesce(p_terms_note,'')),''),sort_order=p_sort_order,is_active=coalesce(p_is_active,true)
    where id=p_id returning * into v_row;
    if not found then raise exception 'VALIDATION: Add-On Intensive Mentoring tidak ditemukan.' using errcode='P0001'; end if;
  end if;
  if v_row.code='WIN_GUARANTEE_PROTECTION' and v_row.is_active then
    raise exception 'VALIDATION: Win Guarantee tetap nonaktif sampai syarat legal final disetujui.' using errcode='P0001';
  end if;
  delete from public.intensive_mentoring_add_on_features where add_on_id=v_row.id;
  for v_feature in select value from jsonb_array_elements(coalesce(p_features,'[]'::jsonb)) loop
    v_text := btrim(coalesce(v_feature->>'text',''));
    if v_text <> '' then
      v_sort := v_sort + 1;
      insert into public.intensive_mentoring_add_on_features(add_on_id,text,sort_order,is_active) values(v_row.id,v_text,v_sort,true);
    end if;
  end loop;
  return v_row;
end;
$$;

create or replace function public.admin_save_intensive_bundle(
  p_id uuid, p_name text, p_description text, p_price_amount bigint, p_badge_text text,
  p_sort_order integer, p_is_active boolean, p_items jsonb
) returns public.intensive_mentoring_bundles
language plpgsql security definer set search_path='' as $$
declare
  v_row public.intensive_mentoring_bundles;
  v_slug text;
  v_code text;
  v_item jsonb;
  v_type text;
  v_ref uuid;
  v_text text;
  v_sort integer := 0;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if btrim(coalesce(p_name,''))='' or btrim(coalesce(p_description,''))='' or p_sort_order < 0 then
    raise exception 'VALIDATION: Nama, deskripsi, dan urutan wajib valid.' using errcode='P0001';
  end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' then
    raise exception 'VALIDATION: Format isi bundle tidak valid.' using errcode='P0001';
  end if;
  if p_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'));
    v_code := trim(both '_' from regexp_replace(upper(btrim(p_name)), '[^A-Z0-9]+', '_', 'g'));
    if v_slug='' or v_code='' then raise exception 'VALIDATION: Nama belum menghasilkan identifier yang valid.' using errcode='P0001'; end if;
    if exists(select 1 from public.intensive_mentoring_bundles where slug=v_slug or code=v_code) then
      raise exception 'VALIDATION: Nama menghasilkan identifier yang sudah digunakan.' using errcode='P0001';
    end if;
    insert into public.intensive_mentoring_bundles(code,slug,name,description,price_amount,badge_text,sort_order,is_active)
    values(v_code,v_slug,btrim(p_name),btrim(p_description),p_price_amount,nullif(btrim(coalesce(p_badge_text,'')),''),p_sort_order,coalesce(p_is_active,true)) returning * into v_row;
  else
    update public.intensive_mentoring_bundles
    set name=btrim(p_name),description=btrim(p_description),price_amount=p_price_amount,badge_text=nullif(btrim(coalesce(p_badge_text,'')),''),sort_order=p_sort_order,is_active=coalesce(p_is_active,true)
    where id=p_id returning * into v_row;
    if not found then raise exception 'VALIDATION: Bundle Intensive Mentoring tidak ditemukan.' using errcode='P0001'; end if;
  end if;
  if v_row.code='COMPETITION_ASSURANCE' and v_row.is_active then
    raise exception 'VALIDATION: Competition Assurance tetap nonaktif sampai dependency guarantee dan ketentuan legal final disetujui.' using errcode='P0001';
  end if;
  delete from public.intensive_mentoring_bundle_items where bundle_id=v_row.id;
  for v_item in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    v_type := coalesce(v_item->>'item_type','');
    v_sort := v_sort + 1;
    if v_type='package' then
      v_ref := nullif(v_item->>'reference_id','')::uuid;
      if v_ref is null or not exists(select 1 from public.intensive_mentoring_packages where id=v_ref) then
        raise exception 'VALIDATION: Paket bundle tidak ditemukan.' using errcode='P0001';
      end if;
      if v_row.is_active and not exists(select 1 from public.intensive_mentoring_packages where id=v_ref and is_active) then
        raise exception 'VALIDATION: Bundle aktif hanya boleh merujuk paket aktif.' using errcode='P0001';
      end if;
      insert into public.intensive_mentoring_bundle_items(bundle_id,item_type,package_id,sort_order,is_active) values(v_row.id,'package',v_ref,v_sort,true);
    elsif v_type='add_on' then
      v_ref := nullif(v_item->>'reference_id','')::uuid;
      if v_ref is null or not exists(select 1 from public.intensive_mentoring_add_ons where id=v_ref) then
        raise exception 'VALIDATION: Add-On bundle tidak ditemukan.' using errcode='P0001';
      end if;
      if v_row.is_active and not exists(select 1 from public.intensive_mentoring_add_ons where id=v_ref and is_active) then
        raise exception 'VALIDATION: Bundle aktif hanya boleh merujuk Add-On aktif.' using errcode='P0001';
      end if;
      insert into public.intensive_mentoring_bundle_items(bundle_id,item_type,add_on_id,sort_order,is_active) values(v_row.id,'add_on',v_ref,v_sort,true);
    elsif v_type='feature' then
      v_text := btrim(coalesce(v_item->>'text',''));
      if v_text='' then raise exception 'VALIDATION: Benefit teks bundle tidak boleh kosong.' using errcode='P0001'; end if;
      insert into public.intensive_mentoring_bundle_items(bundle_id,item_type,feature_text,sort_order,is_active) values(v_row.id,'feature',v_text,v_sort,true);
    else
      raise exception 'VALIDATION: Jenis item bundle tidak didukung.' using errcode='P0001';
    end if;
  end loop;
  return v_row;
end;
$$;

revoke all on function public.admin_upsert_private_mentoring_learning_path(uuid,text,text,integer,boolean),
  public.admin_upsert_private_mentoring_session_focus(uuid,text,text,integer,boolean),
  public.admin_upsert_competition_category(uuid,text,integer,boolean),
  public.admin_delete_mentoring_master(text,uuid),
  public.admin_save_intensive_package(uuid,text,text,text,integer,text,bigint,bigint,integer,boolean,jsonb),
  public.admin_save_intensive_add_on(uuid,text,text,bigint,text,integer,boolean,jsonb),
  public.admin_save_intensive_bundle(uuid,text,text,bigint,text,integer,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.admin_upsert_private_mentoring_learning_path(uuid,text,text,integer,boolean),
  public.admin_upsert_private_mentoring_session_focus(uuid,text,text,integer,boolean),
  public.admin_upsert_competition_category(uuid,text,integer,boolean),
  public.admin_delete_mentoring_master(text,uuid),
  public.admin_save_intensive_package(uuid,text,text,text,integer,text,bigint,bigint,integer,boolean,jsonb),
  public.admin_save_intensive_add_on(uuid,text,text,bigint,text,integer,boolean,jsonb),
  public.admin_save_intensive_bundle(uuid,text,text,bigint,text,integer,boolean,jsonb) to authenticated, service_role;
