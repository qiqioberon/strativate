import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => readFile(path.join(root, file), 'utf8')

test('fixed-slot migration preserves legacy content and normalizes Featured Stories to exactly two placements', async () => {
  const migration = await read('supabase/migrations/202610080003_about_featured_stories_fixed_slots.sql')

  assert.match(migration, /create table public\.about_featured_stories_legacy_20261008 as/i)
  assert.match(migration, /add column slot text/i)
  assert.match(migration, /row_number\(\) over \(order by display_order, created_at, id\)/i)
  assert.match(migration, /when 1 then 'story_one'/i)
  assert.match(migration, /when 2 then 'story_two'/i)
  assert.match(migration, /delete from public\.about_featured_stories[\s\S]*where slot is null/i)
  assert.match(migration, /insert into public\.about_featured_stories \(slot, media_layout, display_order, is_active\)[\s\S]*'story_one', 'single', 1, false/i)
  assert.match(migration, /insert into public\.about_featured_stories \(slot, media_layout, display_order, is_active\)[\s\S]*'story_two', 'pair', 2, false/i)
  assert.match(migration, /about_featured_stories_slot_key unique \(slot\)/i)
  assert.match(migration, /slot in \('story_one', 'story_two'\)/i)
  assert.match(migration, /about_featured_stories_fixed_layout_check/i)
  assert.match(migration, /about_featured_stories_active_complete_check/i)
  assert.match(migration, /drop function if exists public\.reorder_about_featured_stories\(uuid\[\]\)/i)
  assert.doesNotMatch(migration, /Approved active story|Approved quote|Tim Yuaiyuk|SMAK/i)
})

test('fixed-slot permissions allow Admin updates but remove collection-style insert/delete controls', async () => {
  const migration = await read('supabase/migrations/202610080003_about_featured_stories_fixed_slots.sql')

  assert.match(migration, /drop policy if exists about_featured_stories_admin_insert/i)
  assert.match(migration, /drop policy if exists about_featured_stories_admin_delete/i)
  assert.match(migration, /revoke all on public\.about_featured_stories from anon, authenticated/i)
  assert.match(migration, /grant update \([\s\S]*is_active[\s\S]*\) on public\.about_featured_stories to authenticated/i)
  const publicGrant = migration.match(/grant select \([\s\S]*?\) on public\.about_featured_stories to anon, authenticated/i)?.[0] ?? ''
  assert.match(publicGrant, /slot/)
  assert.match(publicGrant, /primary_image_path/)
  assert.match(publicGrant, /secondary_image_path/)
  assert.doesNotMatch(publicGrant, /source_path|image_crop/)
})

test('public About renderer follows the fixed reference composition instead of generic alternating cards', async () => {
  const [page, component, css] = await Promise.all([
    read('app/tentang-kami/page.tsx'),
    read('components/marketing/about-featured-stories.tsx'),
    read('app/marketing.css'),
  ])

  assert.match(page, /listActiveAboutFeaturedStories/)
  assert.ok(page.indexOf('about-expertise-section') < page.indexOf('<AboutFeaturedStories'))
  assert.match(component, /story\.slot === 'story_one'/)
  assert.match(component, /story\.slot === 'story_two'/)
  assert.match(component, /const storyNumber = story\.slot === 'story_one' \? 'one' : 'two'/)
  assert.match(component, /about-featured-story--\$\{storyNumber\}/)
  assert.match(component, /width=\{1200\}[\s\S]*height=\{900\}/)
  assert.match(component, /width=\{900\}[\s\S]*height=\{1200\}/)
  assert.doesNotMatch(component, /index % 2|More Success Stories|href="\/publications"/)
  assert.match(css, /\.about-featured-story--one[\s\S]*background:\s*#fff/i)
  assert.match(css, /\.about-featured-story--two[\s\S]*background:\s*#f7f7f8/i)
  assert.match(css, /about-featured-story__media--single img[\s\S]*aspect-ratio:\s*4\s*\/\s*3/i)
  assert.match(css, /about-featured-story__media--pair img[\s\S]*aspect-ratio:\s*3\s*\/\s*4/i)
  assert.match(css, /about-featured-story__quote-badge[\s\S]*border-radius:\s*12px/i)
})

test('Admin exposes two fixed Featured Story slots with no add, delete, reorder, or layout selector', async () => {
  const [group, manager, config] = await Promise.all([
    read('components/admin/about-us-content-management.tsx'),
    read('components/admin/about-featured-story-management.tsx'),
    read('lib/marketing/about-featured-story-config.ts'),
  ])

  assert.match(group, /Featured Stories/)
  assert.match(group, /<AboutFeaturedStoryManagement/)
  assert.match(manager, /ABOUT_FEATURED_STORY_SLOTS/)
  assert.match(manager, />2 fixed slots</)
  assert.match(manager, /story\.slot === 'story_two'/)
  assert.match(manager, /\.update\(payload\)[\s\S]*\.eq\('slot', selectedSlot\)/)
  assert.match(manager, /AdminImageUploadField/)
  assert.match(manager, /PHOTO_SOURCE_BUCKET/)
  assert.match(manager, /database status could not be confirmed/)
  assert.doesNotMatch(manager, /Add Story|Delete Featured Story|reorder_about_featured_stories|Move .* up|Move .* down|Media layout/)
  assert.doesNotMatch(manager, /\.insert\(|\.delete\(/)
  assert.match(config, /story_one[\s\S]*imageCount:\s*1/)
  assert.match(config, /story_two[\s\S]*imageCount:\s*2/)
  assert.match(config, /width:\s*1200[\s\S]*height:\s*900/)
  assert.match(config, /width:\s*900[\s\S]*height:\s*1200/)
})
