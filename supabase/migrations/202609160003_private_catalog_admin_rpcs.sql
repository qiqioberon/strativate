-- Admin RPCs keep technical identifiers stable and provide safe-delete semantics for operationally referenced masters.
create or replace function public.admin_upsert_private_mentoring_learning_path(
  p_id uuid, p_name text, p_description text, p_sort_order integer, p_is_active boolean
) returns public.private_mentoring_learning_paths
language plpgsql security definer set search_path='' as $$
declare
  v_row public.private_mentoring_learning_paths;
  v_slug text;
  v_code text;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if btrim(coalesce(p_name,''))='' or btrim(coalesce(p_description,''))='' or p_sort_order < 0 then
    raise exception 'VALIDATION: Nama, deskripsi, dan urutan wajib valid.' using errcode='P0001';
  end if;
  if p_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'));
    v_code := trim(both '_' from regexp_replace(upper(btrim(p_name)), '[^A-Z0-9]+', '_', 'g'));
    if v_slug='' or v_code='' then raise exception 'VALIDATION: Nama belum menghasilkan identifier yang valid.' using errcode='P0001'; end if;
    if exists(select 1 from public.private_mentoring_learning_paths where slug=v_slug or code=v_code) then
      raise exception 'VALIDATION: Nama menghasilkan identifier yang sudah digunakan.' using errcode='P0001';
    end if;
    insert into public.private_mentoring_learning_paths(code,slug,name,description,sort_order,is_active)
    values(v_code,v_slug,btrim(p_name),btrim(p_description),p_sort_order,coalesce(p_is_active,true)) returning * into v_row;
  else
    update public.private_mentoring_learning_paths set name=btrim(p_name),description=btrim(p_description),sort_order=p_sort_order,is_active=coalesce(p_is_active,true)
    where id=p_id returning * into v_row;
    if not found then raise exception 'VALIDATION: Learning Path tidak ditemukan.' using errcode='P0001'; end if;
  end if;
  return v_row;
end;
$$;

create or replace function public.admin_upsert_private_mentoring_session_focus(
  p_id uuid, p_name text, p_description text, p_sort_order integer, p_is_active boolean
) returns public.private_mentoring_session_focuses
language plpgsql security definer set search_path='' as $$
declare
  v_row public.private_mentoring_session_focuses;
  v_slug text;
  v_code text;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if btrim(coalesce(p_name,''))='' or btrim(coalesce(p_description,''))='' or p_sort_order < 0 then
    raise exception 'VALIDATION: Nama, deskripsi, dan urutan wajib valid.' using errcode='P0001';
  end if;
  if p_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'));
    v_code := trim(both '_' from regexp_replace(upper(btrim(p_name)), '[^A-Z0-9]+', '_', 'g'));
    if v_slug='' or v_code='' then raise exception 'VALIDATION: Nama belum menghasilkan identifier yang valid.' using errcode='P0001'; end if;
    if exists(select 1 from public.private_mentoring_session_focuses where slug=v_slug or code=v_code) then
      raise exception 'VALIDATION: Nama menghasilkan identifier yang sudah digunakan.' using errcode='P0001';
    end if;
    insert into public.private_mentoring_session_focuses(code,slug,name,description,sort_order,is_active)
    values(v_code,v_slug,btrim(p_name),btrim(p_description),p_sort_order,coalesce(p_is_active,true)) returning * into v_row;
  else
    update public.private_mentoring_session_focuses set name=btrim(p_name),description=btrim(p_description),sort_order=p_sort_order,is_active=coalesce(p_is_active,true)
    where id=p_id returning * into v_row;
    if not found then raise exception 'VALIDATION: Session Topic tidak ditemukan.' using errcode='P0001'; end if;
  end if;
  return v_row;
end;
$$;

create or replace function public.admin_upsert_competition_category(
  p_id uuid, p_name text, p_sort_order integer, p_is_active boolean
) returns public.competition_categories
language plpgsql security definer set search_path='' as $$
declare
  v_row public.competition_categories;
  v_slug text;
  v_code text;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if btrim(coalesce(p_name,''))='' or p_sort_order < 0 then
    raise exception 'VALIDATION: Nama dan urutan wajib valid.' using errcode='P0001';
  end if;
  if p_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'));
    v_code := trim(both '_' from regexp_replace(upper(btrim(p_name)), '[^A-Z0-9]+', '_', 'g'));
    if v_slug='' or v_code='' then raise exception 'VALIDATION: Nama belum menghasilkan identifier yang valid.' using errcode='P0001'; end if;
    if exists(select 1 from public.competition_categories where slug=v_slug or code=v_code) then
      raise exception 'VALIDATION: Nama menghasilkan identifier yang sudah digunakan.' using errcode='P0001';
    end if;
    insert into public.competition_categories(code,slug,name,sort_order,is_active)
    values(v_code,v_slug,btrim(p_name),p_sort_order,coalesce(p_is_active,true)) returning * into v_row;
  else
    update public.competition_categories set name=btrim(p_name),sort_order=p_sort_order,is_active=coalesce(p_is_active,true)
    where id=p_id returning * into v_row;
    if not found then raise exception 'VALIDATION: Competition Category tidak ditemukan.' using errcode='P0001'; end if;
  end if;
  return v_row;
end;
$$;

create or replace function public.admin_delete_mentoring_master(p_table text, p_id uuid)
returns text
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_table='private_mentoring_learning_paths' then
    if exists(select 1 from public.private_mentoring_enrollments where learning_path_id=p_id) then return 'deactivate_required'; end if;
    delete from public.private_mentoring_learning_paths where id=p_id;
  elsif p_table='private_mentoring_session_focuses' then
    if exists(select 1 from public.private_mentoring_sessions where session_focus_id=p_id) then return 'deactivate_required'; end if;
    delete from public.private_mentoring_session_focuses where id=p_id;
  elsif p_table='competition_categories' then
    if exists(select 1 from public.private_mentoring_enrollments where competition_category_id=p_id) then return 'deactivate_required'; end if;
    delete from public.competition_categories where id=p_id;
  else
    raise exception 'VALIDATION: Master table tidak didukung.' using errcode='P0001';
  end if;
  if not found then return 'not_found'; end if;
  return 'deleted';
end;
$$;
