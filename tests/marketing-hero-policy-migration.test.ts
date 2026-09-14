import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'

const migrationsDirectory = new URL('../supabase/migrations/', import.meta.url)
const heroMigrationNames = readdirSync(migrationsDirectory)
  .filter(name => name.includes('marketing_hero_poster'))
  .sort()
const baseMigration = readFileSync(new URL('../supabase/migrations/202609120001_marketing_hero_posters.sql', import.meta.url), 'utf8')
const naturalOrderMigration = readFileSync(new URL('../supabase/migrations/202609140001_marketing_hero_poster_natural_order.sql', import.meta.url), 'utf8')

test('hero poster schema and natural ordering forward migration are tracked', () => {
  assert.deepEqual(heroMigrationNames, [
    '202609120001_marketing_hero_posters.sql',
    '202609140001_marketing_hero_poster_natural_order.sql',
  ])
})

test('hero poster image path validation avoids unsupported PostgreSQL regex bounds', () => {
  const repetitionBounds = [...baseMigration.matchAll(/\{\d+,(\d+)\}/g)].map(match => Number(match[1]))
  assert.ok(repetitionBounds.every(maximum => maximum <= 255))
  assert.match(baseMigration, /char_length\(image_path\)\s+between\s+9\s+and\s+508/i)
})

test('hero poster public reads do not require anon callers to execute the admin helper', () => {
  assert.match(baseMigration, /for select to anon, authenticated\s+using \(is_active\)/i)
  assert.match(baseMigration, /for select to authenticated\s+using \(public\.is_admin\(\)\)/i)
  assert.doesNotMatch(baseMigration, /grant execute on function public\.is_admin\(\) to anon/i)
})

test('hero poster reordering keeps stale-order protection and normalizes positions to one-based integers', () => {
  assert.match(naturalOrderMigration, /row_number\(\)\s+over\s*\(\s*order by sort_order, created_at, id\s*\)/i)
  assert.match(naturalOrderMigration, /lock table public\.marketing_hero_posters in share row exclusive mode/i)
  assert.match(naturalOrderMigration, /select count\(\*\) into v_total_count from public\.marketing_hero_posters/i)
  assert.match(naturalOrderMigration, /v_total_count <> cardinality\(p_ids\)/i)
  assert.match(naturalOrderMigration, /set sort_order = ordering\.ordinality::integer/i)
  assert.doesNotMatch(naturalOrderMigration, /ordinality\s*\*\s*10/i)
})
