import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/202609280001_homepage_who_we_are_photos.sql', import.meta.url),
  'utf8',
)

test('who-we-are migration creates an unseeded fixed-role photo table', () => {
  assert.match(migration, /create table public\.homepage_who_we_are_photos/i)
  assert.match(migration, /role text primary key/i)
  assert.match(migration, /role in \('primary', 'upper_right', 'lower_right'\)/i)
  assert.match(migration, /image_path text unique/i)
  assert.match(migration, /alt_text text/i)
  assert.match(migration, /badge_text text/i)
  assert.match(migration, /image_path is null[\s\S]*alt_text is null[\s\S]*badge_text is null/i)
  assert.match(migration, /image_path is not null[\s\S]*alt_text is not null[\s\S]*alt_text = btrim\(alt_text\)/i)
  assert.match(migration, /role = 'primary'[\s\S]*\^who-we-are\/primary\//i)
  assert.match(migration, /role = 'upper_right'[\s\S]*\^who-we-are\/upper_right\//i)
  assert.match(migration, /role = 'lower_right'[\s\S]*\^who-we-are\/lower_right\//i)
  assert.doesNotMatch(migration, /insert into public\.homepage_who_we_are_photos/i)
})

test('who-we-are table is publicly readable and admin-mutable only', () => {
  assert.match(migration, /alter table public\.homepage_who_we_are_photos enable row level security/i)
  assert.match(migration, /for select to anon, authenticated[\s\S]*using \(true\)/i)
  assert.match(migration, /for insert to authenticated[\s\S]*public\.is_admin\(\)/i)
  assert.match(migration, /for update to authenticated[\s\S]*public\.is_admin\(\)/i)
  assert.match(migration, /for delete to authenticated[\s\S]*public\.is_admin\(\)/i)
  assert.match(migration, /revoke all on public\.homepage_who_we_are_photos from anon, authenticated/i)
  assert.match(migration, /grant select \([\s\S]*\)\s+on public\.homepage_who_we_are_photos to anon, authenticated/i)
  assert.match(migration, /grant all on public\.homepage_who_we_are_photos to service_role/i)
})

test('shared editorial storage policies preserve prior prefixes and narrowly allow fixed who-we-are WebPs', () => {
  for (const prefix of ['publications/%', 'competitions/%', 'recognition-logos/%']) {
    assert.match(migration, new RegExp(prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  }
  assert.match(migration, /name ~ '\^who-we-are\/\(primary\|upper_right\|lower_right\)\/\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[1-5\]\[0-9a-f\]\{3\}-\[89ab\]\[0-9a-f\]\{3\}-\[0-9a-f\]\{12\}\\\.webp\$'/i)
  assert.match(migration, /marketing_editorial_public_read[\s\S]*for select to anon, authenticated/i)
  assert.match(migration, /marketing_editorial_admin_insert[\s\S]*public\.is_admin\(\)/i)
  assert.match(migration, /marketing_editorial_admin_update[\s\S]*public\.is_admin\(\)/i)
  assert.match(migration, /marketing_editorial_admin_delete[\s\S]*public\.is_admin\(\)/i)
  assert.match(migration, /name not like '%\.\.%'/i)
  assert.match(migration, /name not like '%\/\/%'/i)
})
