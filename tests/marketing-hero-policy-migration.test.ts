import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'

const migrationsDirectory = new URL('../supabase/migrations/', import.meta.url)
const heroMigrationNames = readdirSync(migrationsDirectory)
  .filter(name => name.includes('marketing_hero_poster'))
  .sort()
const migration = readFileSync(new URL('../supabase/migrations/202609120001_marketing_hero_posters.sql', import.meta.url), 'utf8')

test('hero poster schema, policies, and ordering ship in one development migration', () => {
  assert.deepEqual(heroMigrationNames, ['202609120001_marketing_hero_posters.sql'])
})

test('hero poster image path validation avoids unsupported PostgreSQL regex bounds', () => {
  const repetitionBounds = [...migration.matchAll(/\{\d+,(\d+)\}/g)].map(match => Number(match[1]))
  assert.ok(repetitionBounds.every(maximum => maximum <= 255))
  assert.match(migration, /char_length\(image_path\)\s+between\s+9\s+and\s+508/i)
})

test('hero poster public reads do not require anon callers to execute the admin helper', () => {
  assert.match(migration, /for select to anon, authenticated\s+using \(is_active\)/i)
  assert.match(migration, /for select to authenticated\s+using \(public\.is_admin\(\)\)/i)
  assert.doesNotMatch(migration, /grant execute on function public\.is_admin\(\) to anon/i)
})

test('hero poster reordering locks and rejects stale partial catalog order', () => {
  assert.match(migration, /lock table public\.marketing_hero_posters in share row exclusive mode/i)
  assert.match(migration, /select count\(\*\) into v_total_count from public\.marketing_hero_posters/i)
  assert.match(migration, /v_total_count <> cardinality\(p_ids\)/i)
})
