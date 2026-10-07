import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('../app/tentang-kami/page.tsx', import.meta.url), 'utf8')
const marketing = readFileSync(new URL('../app/marketing.css', import.meta.url), 'utf8')
const admin = readFileSync(new URL('../components/admin/about-story-image-management.tsx', import.meta.url), 'utf8')
const adminGroup = readFileSync(new URL('../components/admin/about-us-content-management.tsx', import.meta.url), 'utf8')
const adminPage = readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8')
const config = readFileSync(new URL('../lib/marketing/about-us-story-config.ts', import.meta.url), 'utf8')
const reader = readFileSync(new URL('../lib/marketing/about-us-story.ts', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/202610080002_about_us_story_media.sql', import.meta.url), 'utf8')
const types = readFileSync(new URL('../lib/supabase/database.types.ts', import.meta.url), 'utf8')

test('About Us story uses a clean responsive split layout while preserving Featured Stories', () => {
  assert.match(page, /getAboutUsStoryMedia\(\)/)
  assert.match(page, /listActiveAboutFeaturedStories\(\)/)
  assert.match(page, /about-reference-story__copy/)
  assert.match(page, /<h2>Empowering Future Business Leaders<\/h2>/)
  assert.doesNotMatch(page, /<em>|Editorial image slot|BrandLogo/)
  assert.match(page, /storyMedia \? \(/)
  assert.ok(page.indexOf('about-expertise-section') < page.indexOf('<AboutFeaturedStories'))
  assert.match(marketing, /\.about-reference-hero__grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\.92fr\) minmax\(400px,1\.08fr\)/)
  assert.match(marketing, /\.about-featured-stories\s*\{/)
})

test('About Us Admin keeps grouped content and adds Story Image', () => {
  assert.match(adminPage, /id: 'About Us Content', label: 'About Us Content'/)
  assert.doesNotMatch(adminPage, /id: 'Who We Are Photos'/)
  assert.match(adminGroup, /Who We Are Photos/)
  assert.match(adminGroup, /Story Image/)
  assert.match(adminGroup, /Featured Stories/)
  assert.match(adminGroup, /<AboutStoryImageManagement/)
  assert.match(admin, /persistAdminImage/)
  assert.match(admin, /admin_list_about_us_story_media/)
})

test('About Us migration follows Featured Stories and preserves both storage prefixes', () => {
  assert.match(migration, /create table public\.about_us_story_media/)
  assert.match(migration, /'about-featured-stories', 'about-us'/)
  assert.match(migration, /\^about-featured-stories\/[\s\S]*\\\.webp\$/)
  assert.match(migration, /\^about-us\/[\s\S]*\\\.webp\$/)
  assert.match(types, /export type AboutUsStoryMedia/)
  assert.match(types, /about_us_story_media: Table<AboutUsStoryMedia/)
  assert.match(types, /admin_list_about_us_story_media/)
})
