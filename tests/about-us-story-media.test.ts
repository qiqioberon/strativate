import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('../app/tentang-kami/page.tsx', import.meta.url), 'utf8')
const marketing = readFileSync(new URL('../app/marketing.css', import.meta.url), 'utf8')
const admin = readFileSync(new URL('../components/admin/about-us-content-management.tsx', import.meta.url), 'utf8')
const adminPage = readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8')
const config = readFileSync(new URL('../lib/marketing/about-us-story-config.ts', import.meta.url), 'utf8')
const reader = readFileSync(new URL('../lib/marketing/about-us-story.ts', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/202610080001_about_us_story_media.sql', import.meta.url), 'utf8')
const types = readFileSync(new URL('../lib/supabase/database.types.ts', import.meta.url), 'utf8')

test('About Us story uses a clean responsive split layout and admin-managed final media', () => {
  assert.match(page, /export default async function AboutPage/)
  assert.match(page, /getAboutUsStoryMedia\(\)/)
  assert.match(page, /about-reference-story__copy/)
  assert.match(page, /<h2>Empowering Future Business Leaders<\/h2>/)
  assert.doesNotMatch(page, /<em>|Editorial image slot|BrandLogo/)
  assert.match(page, /storyMedia \? \(/)
  assert.match(page, /ABOUT_US_STORY_IMAGE_WIDTH/)
  assert.match(marketing, /\.about-reference-hero__grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\.92fr\) minmax\(400px,1\.08fr\)/)
  assert.match(marketing, /@media \(max-width: 900px\)[\s\S]*\.about-reference-hero__grid[^}]*grid-template-columns:\s*minmax\(0,1fr\)/)
})

test('About Us media target is one locked 4:3 high-resolution WebP slot', () => {
  assert.match(config, /ABOUT_US_STORY_IMAGE_WIDTH = 1600/)
  assert.match(config, /ABOUT_US_STORY_IMAGE_HEIGHT = 1200/)
  assert.match(config, /ABOUT_US_STORY_IMAGE_PREFIX = 'about-us\/'/)
  assert.match(config, /ABOUT_US_STORY_SOURCE_PREFIX = 'about-us\/'/)
  assert.match(reader, /select\('image_path,alt_text'\)/)
  assert.doesNotMatch(reader, /source_image_path|image_crop/)
})

test('About Us Admin reuses the shared crop and safe replacement infrastructure', () => {
  assert.match(adminPage, /id: 'About Us Content', label: 'About Us Content'/)
  assert.match(adminPage, /section === 'About Us Content' \? <AboutUsContentManagement\/>/)
  assert.match(admin, /AdminImageUploadField/)
  assert.match(admin, /useAdminImageUpload/)
  assert.match(admin, /persistAdminImage/)
  assert.match(admin, /admin_list_about_us_story_media/)
  assert.match(admin, /Final output|ABOUT_US_STORY_IMAGE_TARGET/)
})

test('About Us migration keeps originals private and exposes only the final derivative publicly', () => {
  assert.match(migration, /create table public\.about_us_story_media/)
  assert.match(migration, /image_crop jsonb/)
  assert.match(migration, /source_image_path text/)
  assert.match(migration, /grant select \(id, image_path, alt_text, created_at, updated_at\)/)
  assert.match(migration, /admin_list_about_us_story_media/)
  assert.match(migration, /update storage\.buckets set public = false where id = 'marketing-photo-sources'/)
  assert.match(migration, /'competition-recognitions', 'trusted-partners', 'about-us'/)
  assert.match(migration, /\^about-us\/[\s\S]*\\\.webp\$/)
  assert.match(types, /export type AboutUsStoryMedia/)
  assert.match(types, /about_us_story_media: Table<AboutUsStoryMedia/)
  assert.match(types, /admin_list_about_us_story_media/)
})
