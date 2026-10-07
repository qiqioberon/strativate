import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => readFile(path.join(root, file), 'utf8')

test('featured stories migration is additive, unseeded, active-only, and keeps source metadata private', async () => {
  const migration = await read('supabase/migrations/202610080001_about_featured_stories.sql')
  assert.match(migration, /create table public\.about_featured_stories/i)
  assert.match(migration, /media_layout in \('single', 'pair'\)/i)
  assert.match(migration, /about_featured_stories_media_slots_check/i)
  assert.match(migration, /primary_image_crop jsonb not null/i)
  assert.match(migration, /secondary_image_crop jsonb/i)
  assert.doesNotMatch(migration, /insert into public\.about_featured_stories/i)
  assert.match(migration, /for select to anon, authenticated[\s\S]*using \(is_active\)/i)
  const publicGrant = migration.match(/grant select \([\s\S]*?\) on public\.about_featured_stories to anon, authenticated/i)?.[0] ?? ''
  assert.match(publicGrant, /primary_image_path/i)
  assert.match(publicGrant, /secondary_image_path/i)
  assert.doesNotMatch(publicGrant, /source_path|image_crop/i)
  assert.match(migration, /admin_list_about_featured_stories/i)
  assert.match(migration, /reorder_about_featured_stories/i)
})

test('featured story storage preserves private originals and exposes only processed story WebPs', async () => {
  const migration = await read('supabase/migrations/202610080001_about_featured_stories.sql')
  assert.match(migration, /update storage\.buckets[\s\S]*set public = false[\s\S]*where id = 'marketing-photo-sources'/i)
  assert.match(migration, /marketing_photo_sources_admin_insert[\s\S]*public\.is_admin\(\)/i)
  assert.match(migration, /marketing_photo_sources_admin_insert[\s\S]*'about-featured-stories'/i)
  assert.match(migration, /marketing_editorial_public_read[\s\S]*\^about-featured-stories\/[\s\S]*\\\.webp\$/i)
  assert.match(migration, /marketing_editorial_admin_insert[\s\S]*public\.is_admin\(\)/i)
})

test('About page reads active stories and appends the section after expertise', async () => {
  const page = await read('app/tentang-kami/page.tsx')
  const component = await read('components/marketing/about-featured-stories.tsx')
  assert.match(page, /listActiveAboutFeaturedStories/)
  assert.ok(page.indexOf('about-expertise-section') < page.indexOf('<AboutFeaturedStories'))
  assert.match(component, />FEATURED STORY</)
  assert.match(component, /index % 2/)
  assert.match(component, /media_layout === 'pair'/)
  assert.match(component, /loading="lazy"/)
  assert.match(component, /href="\/publications"/)
  assert.match(component, /More Success Stories/)
})

test('Admin groups Who We Are photos and Featured Stories under one About Us content entry', async () => {
  const [page, group, manager] = await Promise.all([
    read('app/admin/page.tsx'),
    read('components/admin/about-us-content-management.tsx'),
    read('components/admin/about-featured-story-management.tsx'),
  ])
  assert.match(page, /'About Us Content'/)
  assert.doesNotMatch(page, /id: 'Who We Are Photos'/)
  assert.match(group, /Who We Are Photos/)
  assert.match(group, /Featured Stories/)
  assert.match(group, /<WhoWeArePhotoManagement/)
  assert.match(group, /<AboutFeaturedStoryManagement/)
  assert.match(manager, /admin_list_about_featured_stories/)
  assert.match(manager, /reorder_about_featured_stories/)
  assert.match(manager, /AdminImageUploadField/)
  assert.match(manager, /useAdminImageUpload/)
  assert.match(manager, /primaryImage/)
  assert.match(manager, /secondaryImage/)
  assert.match(manager, /PHOTO_SOURCE_BUCKET/)
  assert.match(manager, /database status could not be confirmed/)
})
