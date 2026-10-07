-- Convert About Featured Stories from an arbitrary collection into two fixed editorial slots.
-- Existing content is snapshotted before normalization so no prior admin-entered story data is silently lost.

create table public.about_featured_stories_legacy_20261008 as
select * from public.about_featured_stories;

revoke all on public.about_featured_stories_legacy_20261008 from public, anon, authenticated;
grant all on public.about_featured_stories_legacy_20261008 to service_role;
alter table public.about_featured_stories_legacy_20261008 enable row level security;

comment on table public.about_featured_stories_legacy_20261008 is
  'Private migration snapshot of the pre-fixed-slot About Featured Stories collection.';

alter table public.about_featured_stories
  add column slot text;

alter table public.about_featured_stories
  drop constraint if exists about_featured_stories_media_slots_check,
  drop constraint if exists about_featured_stories_primary_crop_check;

alter table public.about_featured_stories
  alter column title drop not null,
  alter column quote drop not null,
  alter column attribution_name drop not null,
  alter column attribution_organization drop not null,
  alter column achievement_text drop not null,
  alter column primary_image_path drop not null,
  alter column primary_image_source_path drop not null,
  alter column primary_image_crop drop not null,
  alter column primary_image_alt_text drop not null;

with ranked as (
  select id, row_number() over (order by display_order, created_at, id) as position
  from public.about_featured_stories
)
update public.about_featured_stories story
set slot = case ranked.position
  when 1 then 'story_one'
  when 2 then 'story_two'
  else null
end
from ranked
where story.id = ranked.id;

delete from public.about_featured_stories
where slot is null;

update public.about_featured_stories
set
  media_layout = 'single',
  display_order = 1,
  secondary_image_path = null,
  secondary_image_source_path = null,
  secondary_image_crop = null,
  secondary_image_alt_text = null
where slot = 'story_one';

update public.about_featured_stories
set
  media_layout = 'pair',
  display_order = 2,
  is_active = case
    when secondary_image_path is not null
      and secondary_image_source_path is not null
      and secondary_image_crop is not null
      and secondary_image_alt_text is not null
    then is_active
    else false
  end
where slot = 'story_two';

insert into public.about_featured_stories (slot, media_layout, display_order, is_active)
select 'story_one', 'single', 1, false
where not exists (
  select 1 from public.about_featured_stories where slot = 'story_one'
);

insert into public.about_featured_stories (slot, media_layout, display_order, is_active)
select 'story_two', 'pair', 2, false
where not exists (
  select 1 from public.about_featured_stories where slot = 'story_two'
);

alter table public.about_featured_stories
  alter column slot set not null,
  add constraint about_featured_stories_slot_key unique (slot),
  add constraint about_featured_stories_slot_check
    check (slot in ('story_one', 'story_two')),
  add constraint about_featured_stories_primary_crop_check check (
    primary_image_crop is null or coalesce((
      jsonb_typeof(primary_image_crop) = 'object'
      and jsonb_typeof(primary_image_crop->'x') = 'number'
      and jsonb_typeof(primary_image_crop->'y') = 'number'
      and jsonb_typeof(primary_image_crop->'width') = 'number'
      and jsonb_typeof(primary_image_crop->'height') = 'number'
      and (primary_image_crop->>'x')::numeric between 0 and 1
      and (primary_image_crop->>'y')::numeric between 0 and 1
      and (primary_image_crop->>'width')::numeric > 0
      and (primary_image_crop->>'width')::numeric <= 1
      and (primary_image_crop->>'height')::numeric > 0
      and (primary_image_crop->>'height')::numeric <= 1
      and (primary_image_crop->>'x')::numeric + (primary_image_crop->>'width')::numeric <= 1.000001
      and (primary_image_crop->>'y')::numeric + (primary_image_crop->>'height')::numeric <= 1.000001
    ), false)
  ),
  add constraint about_featured_stories_fixed_layout_check check (
    (
      slot = 'story_one'
      and media_layout = 'single'
      and display_order = 1
      and secondary_image_path is null
      and secondary_image_source_path is null
      and secondary_image_crop is null
      and secondary_image_alt_text is null
    )
    or (
      slot = 'story_two'
      and media_layout = 'pair'
      and display_order = 2
    )
  ),
  add constraint about_featured_stories_active_complete_check check (
    not is_active or (
      title is not null and btrim(title) <> ''
      and quote is not null and btrim(quote) <> ''
      and attribution_name is not null and btrim(attribution_name) <> ''
      and attribution_organization is not null and btrim(attribution_organization) <> ''
      and achievement_text is not null and btrim(achievement_text) <> ''
      and primary_image_path is not null
      and primary_image_source_path is not null
      and primary_image_crop is not null
      and primary_image_alt_text is not null and btrim(primary_image_alt_text) <> ''
      and (
        slot = 'story_one'
        or (
          secondary_image_path is not null
          and secondary_image_source_path is not null
          and secondary_image_crop is not null
          and secondary_image_alt_text is not null
          and btrim(secondary_image_alt_text) <> ''
        )
      )
    )
  );

drop policy if exists about_featured_stories_admin_insert on public.about_featured_stories;
drop policy if exists about_featured_stories_admin_delete on public.about_featured_stories;

drop function if exists public.reorder_about_featured_stories(uuid[]);

create or replace function public.admin_list_about_featured_stories()
returns setof public.about_featured_stories
language sql
stable
security definer
set search_path = ''
as $$
  select story.*
  from public.about_featured_stories story
  where public.is_admin()
  order by story.display_order;
$$;

revoke all on public.about_featured_stories from anon, authenticated;
grant select (
  id, slot, title, quote, attribution_name, attribution_organization, achievement_text,
  media_layout, primary_image_path, primary_image_alt_text, secondary_image_path,
  secondary_image_alt_text, display_order, is_active, created_at, updated_at
) on public.about_featured_stories to anon, authenticated;

grant update (
  title, quote, attribution_name, attribution_organization, achievement_text,
  primary_image_path, primary_image_source_path, primary_image_crop, primary_image_alt_text,
  secondary_image_path, secondary_image_source_path, secondary_image_crop, secondary_image_alt_text,
  is_active
) on public.about_featured_stories to authenticated;

revoke all on function public.admin_list_about_featured_stories() from public, anon, authenticated;
grant execute on function public.admin_list_about_featured_stories() to authenticated;

comment on column public.about_featured_stories.slot is
  'Fixed public About Us placement. story_one is image-left/quote-right; story_two is quote-left/two-images-right.';
comment on table public.about_featured_stories is
  'Exactly two admin-managed About Us Featured Story slots. Admins may update content but cannot add, delete, or reorder slots.';
