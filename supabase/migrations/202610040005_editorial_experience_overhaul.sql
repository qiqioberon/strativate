-- Normalize Publications taxonomy/body storage and editorial ordering while preserving deployed content.
-- Automatic slug assignment remains owned by the existing automatic_insert_slug triggers.

create table public.publication_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 80),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index publication_categories_name_unique
  on public.publication_categories (lower(name));

create index publication_categories_order_idx
  on public.publication_categories (sort_order, name);

create trigger publication_categories_touch_updated_at
  before update on public.publication_categories
  for each row execute function public.touch_updated_at();

alter table public.publication_categories enable row level security;

create policy publication_categories_public_read
  on public.publication_categories for select to anon, authenticated
  using (is_active);

create policy publication_categories_admin_read
  on public.publication_categories for select to authenticated
  using (public.is_admin());

create policy publication_categories_admin_insert
  on public.publication_categories for insert to authenticated
  with check (public.is_admin());

create policy publication_categories_admin_update
  on public.publication_categories for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy publication_categories_admin_delete
  on public.publication_categories for delete to authenticated
  using (public.is_admin());

revoke all on public.publication_categories from anon, authenticated;
grant select on public.publication_categories to anon, authenticated;
grant insert, update, delete on public.publication_categories to authenticated;
grant all on public.publication_categories to service_role;

alter table public.publications
  add column category_id uuid,
  add column body_json jsonb;

insert into public.publication_categories (name, sort_order)
select category_name, row_number() over (order by lower(category_name), category_name)::integer
from (
  select min(btrim(category)) as category_name
  from public.publications
  where category is not null and btrim(category) <> ''
  group by lower(btrim(category))
) existing_categories;

update public.publications publication
set category_id = category.id
from public.publication_categories category
where publication.category is not null
  and lower(btrim(publication.category)) = lower(category.name);

update public.publications publication
set body_json = jsonb_build_object(
  'version', 1,
  'blocks', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'type', 'paragraph',
        'align', 'left',
        'content', jsonb_build_array(jsonb_build_object('text', btrim(part)))
      )
      order by ordinal
    )
    from regexp_split_to_table(publication.body, E'\n[[:space:]]*\n') with ordinality as paragraphs(part, ordinal)
    where btrim(part) <> ''
  ), jsonb_build_array(jsonb_build_object(
    'type', 'paragraph',
    'align', 'left',
    'content', '[]'::jsonb
  )))
)
where body_json is null;

alter table public.publications
  alter column body_json set default '{"version":1,"blocks":[{"type":"paragraph","align":"left","content":[]}]}'::jsonb,
  alter column body_json set not null,
  add constraint publications_category_id_fkey
    foreign key (category_id) references public.publication_categories(id) on delete restrict,
  add constraint publications_body_json_shape_check
    check (
      jsonb_typeof(body_json) = 'object'
      and body_json->>'version' = '1'
      and jsonb_typeof(body_json->'blocks') = 'array'
    );

create index publications_category_id_public_idx
  on public.publications (category_id, published_at desc)
  where is_published;

alter table public.publications
  drop constraint if exists publications_title_check,
  drop constraint if exists publications_excerpt_check,
  drop constraint if exists publications_body_check;

alter table public.publications
  add constraint publications_title_length_check
    check (char_length(btrim(title)) <= 180),
  add constraint publications_excerpt_length_check
    check (char_length(btrim(excerpt)) <= 500),
  add constraint publications_body_length_check
    check (char_length(body) <= 50000);

alter table public.competitions
  drop constraint if exists competitions_name_check,
  drop constraint if exists competitions_description_check;

alter table public.competitions
  add constraint competitions_name_length_check
    check (char_length(btrim(name)) <= 180),
  add constraint competitions_description_length_check
    check (char_length(description) <= 5000);

with ranked as (
  select id, row_number() over (order by sort_order, created_at, id)::integer as position
  from public.publications
)
update public.publications publication
set sort_order = ranked.position
from ranked
where publication.id = ranked.id
  and publication.sort_order is distinct from ranked.position;

with ranked as (
  select id, row_number() over (order by sort_order, created_at, id)::integer as position
  from public.competitions
)
update public.competitions competition
set sort_order = ranked.position
from ranked
where competition.id = ranked.id
  and competition.sort_order is distinct from ranked.position;

create or replace function public.editorial_append_sort_order()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  next_position integer;
begin
  if new.sort_order is null or new.sort_order <= 0 then
    execute format('select coalesce(max(sort_order), 0) + 1 from public.%I', tg_table_name)
      into next_position;
    new.sort_order := next_position;
  end if;
  return new;
end;
$$;

drop trigger if exists publications_append_sort_order on public.publications;
create trigger publications_append_sort_order
  before insert on public.publications
  for each row execute function public.editorial_append_sort_order();

drop trigger if exists competitions_append_sort_order on public.competitions;
create trigger competitions_append_sort_order
  before insert on public.competitions
  for each row execute function public.editorial_append_sort_order();

create trigger publication_categories_append_sort_order
  before insert on public.publication_categories
  for each row execute function public.editorial_append_sort_order();

create or replace function public.sync_publication_category_label()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.category_id is null then
    new.category := null;
  else
    select category.name into new.category
    from public.publication_categories category
    where category.id = new.category_id;
  end if;
  return new;
end;
$$;

drop trigger if exists publications_sync_category_label on public.publications;
create trigger publications_sync_category_label
  before insert or update of category_id on public.publications
  for each row execute function public.sync_publication_category_label();

create or replace function public.propagate_publication_category_name()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.name is distinct from old.name then
    update public.publications
    set category = new.name
    where category_id = new.id;
  end if;
  return new;
end;
$$;

create trigger publication_categories_propagate_name
  after update of name on public.publication_categories
  for each row execute function public.propagate_publication_category_name();

comment on table public.publication_categories is
  'Admin-managed publication taxonomy. Publications reference category IDs so renames propagate safely.';

comment on column public.publications.body_json is
  'Canonical structured publication body. Legacy body text remains as a backward-compatible plain-text projection.';
