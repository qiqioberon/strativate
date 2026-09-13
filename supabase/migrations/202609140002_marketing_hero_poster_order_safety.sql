-- Reject stale reorder requests so concurrent catalog changes cannot produce a
-- partial or ambiguous poster order. The RPC identity and admin boundary remain
-- unchanged for existing clients.

create or replace function public.reorder_marketing_hero_posters(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_matched_count integer;
  v_total_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin account required' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 100 then
    raise exception 'Provide a valid poster order' using errcode = '22023';
  end if;

  lock table public.marketing_hero_posters in share row exclusive mode;
  select count(*) into v_total_count from public.marketing_hero_posters;
  select count(*) into v_matched_count
  from public.marketing_hero_posters
  where id = any(p_ids);

  if v_total_count <> cardinality(p_ids)
    or v_matched_count <> cardinality(p_ids)
    or v_matched_count <> (select count(distinct input_id) from unnest(p_ids) input_ids(input_id)) then
    raise exception 'Poster order is stale or contains missing or duplicate identities' using errcode = '22023';
  end if;

  update public.marketing_hero_posters poster
  set sort_order = ordering.ordinality * 10
  from unnest(p_ids) with ordinality ordering(id, ordinality)
  where poster.id = ordering.id;
end $$;

revoke all on function public.reorder_marketing_hero_posters(uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_marketing_hero_posters(uuid[]) to authenticated;
