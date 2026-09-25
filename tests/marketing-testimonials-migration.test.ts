import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL('../supabase/migrations/202609200002_marketing_testimonials.sql', import.meta.url), 'utf8')
const cleanupMigration = readFileSync(new URL('../supabase/migrations/202609200003_drop_testimonial_metadata.sql', import.meta.url), 'utf8')
const seed = readFileSync(new URL('../supabase/seed/marketing_testimonials.sql', import.meta.url), 'utf8')

test('testimonial migration creates public imagery plus admin-only content mutation', () => {
  assert.match(migration, /create table public\.marketing_testimonials/i)
  assert.match(migration, /image_path text unique check/i)
  assert.match(migration, /using \(is_published and image_path is not null\)/i)
  assert.match(migration, /bucket_id = 'marketing-testimonials'/i)
  assert.match(migration, /public\.is_admin\(\)/i)
  assert.match(migration, /reorder_marketing_testimonials/i)
})

test('testimonial seed is idempotent, ships eight stories, and waits for admin images', () => {
  const slugs = [...seed.matchAll(/\r?\n\s+'([a-z0-9-]+)',\r?\n\s+'[^']+',\r?\n\s+'[^']+',/g)].map(match => match[1])
  assert.equal(slugs.length, 8)
  assert.match(seed, /on conflict \(slug\) do nothing/i)
  assert.equal((seed.match(/\r?\n\s+null,\r?\n\s+'[^']+'/g) ?? []).length, 8)
})

test('testimonial seed keeps competition names and provides English public narratives', () => {
  assert.match(seed, /'YED Universitas Indonesia BCC'/)
  assert.match(seed, /'Business Plan Competition Prasmul ECC'/)
  assert.match(seed, /'Business Case Competition IMPACT UBM'/)
  assert.match(seed, /We are truly grateful/)
  assert.match(seed, /We learned so much/)
  assert.match(seed, /Strativate mentors made every session/)
  assert.doesNotMatch(seed, /Kami ingin mengucapkan terima kasih/)
})


test('testimonial metadata cleanup drops retired database fields without recreating seed data', () => {
  assert.match(cleanupMigration, /drop column if exists participant_label/i)
  assert.match(cleanupMigration, /drop column if exists alt_text/i)
  assert.doesNotMatch(cleanupMigration, /insert into public\.marketing_testimonials/i)
  assert.doesNotMatch(cleanupMigration, /update public\.marketing_testimonials/i)
})
