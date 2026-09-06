-- Privileged local importer only; no browser EXECUTE grant.
create function public.import_institutions_batch(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  existing public.institutions;
  inserted integer := 0;
  updated integer := 0;
  skipped integer := 0;
  affected integer;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 250 then
    raise exception 'Invalid import batch' using errcode = '22023';
  end if;
  -- Serialize importer batches. Official identity is also protected by UNIQUE.
  perform pg_advisory_xact_lock(609060002);
  for r in select value from jsonb_array_elements(p_rows) loop
    if r->>'source' not in ('bima_kemdiktisaintek', 'school_pdf')
      or nullif(btrim(r->>'external_id'), '') is null
      or r->>'approval_status' is distinct from 'approved'
      or r->>'source' is null then
      raise exception 'Invalid official identity' using errcode = '22023';
    end if;
    select * into existing from public.institutions where source = r->>'source' and external_id = r->>'external_id' for update;
    if found and existing.submitted_by is not null then
      raise exception 'Import would overwrite a user submission' using errcode = '42501';
    end if;
    if found and existing.name = r->>'name' and existing.type::text = r->>'type'
      and existing.province is not distinct from r->>'province' and existing.city is not distinct from r->>'city'
      and existing.source_url is not distinct from r->>'source_url' and existing.institution_status is not distinct from r->>'institution_status'
      and existing.approval_status = 'approved' then
      skipped := skipped + 1;
      continue;
    end if;
    -- UPSERT handles races with administrative inserts as well as other importers.
    with changed as (
      insert into public.institutions (name, type, province, city, external_id, source, source_url, approval_status, institution_status)
      values (r->>'name', (r->>'type')::public.institution_type, r->>'province', r->>'city', r->>'external_id', r->>'source', r->>'source_url', 'approved', r->>'institution_status')
      on conflict (source, external_id) do update set name = excluded.name, type = excluded.type,
        province = excluded.province, city = excluded.city, source_url = excluded.source_url,
        approval_status = excluded.approval_status, institution_status = excluded.institution_status
      where institutions.submitted_by is null
      returning (xmax = 0) as was_inserted
    ) select inserted + count(*) filter (where was_inserted), updated + count(*) filter (where not was_inserted), count(*)
      into inserted, updated, affected from changed;
    if affected <> 1 then
      raise exception 'Concurrent record would overwrite a user submission' using errcode = '42501';
    end if;
  end loop;
  return jsonb_build_object('inserted', inserted, 'updated', updated, 'skipped', skipped);
end;
$$;
revoke all on function public.import_institutions_batch(jsonb) from public, anon, authenticated;
grant execute on function public.import_institutions_batch(jsonb) to service_role;
