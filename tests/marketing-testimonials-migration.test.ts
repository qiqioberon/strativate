import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL('../supabase/migrations/202609200002_marketing_testimonials.sql', import.meta.url), 'utf8')
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
  const slugs = [...seed.matchAll(/\n    '([a-z0-9-]+)',\n    '[^']+',\n    '[^']+',/g)].map(match => match[1])
  assert.equal(slugs.length, 8)
  assert.match(seed, /on conflict \(slug\) do nothing/i)
  assert.equal((seed.match(/\n    null,\n    'Tim/g) ?? []).length, 8)
})

test('testimonial seed keeps competition names but localizes testimonial narratives to Indonesian', () => {
  assert.match(seed, /'YED Universitas Indonesia BCC'/)
  assert.match(seed, /'Business Plan Competition Prasmul ECC'/)
  assert.match(seed, /'Business Case Competition IMPACT UBM'/)
  assert.match(seed, /Kami ingin mengucapkan terima kasih/)
  assert.match(seed, /Kami belajar sangat banyak/)
  assert.match(seed, /Mentor Strativate membawakan setiap sesi/)
  assert.doesNotMatch(seed, /We are truly grateful/)
  assert.doesNotMatch(seed, /We learned so much/)
})
