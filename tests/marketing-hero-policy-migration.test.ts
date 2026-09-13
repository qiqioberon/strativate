import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL('../supabase/migrations/202609140001_marketing_hero_poster_public_read.sql', import.meta.url), 'utf8')

test('hero poster public reads do not require anon callers to execute the admin helper', () => {
  assert.match(migration, /drop policy if exists marketing_hero_posters_public_read/i)
  assert.match(migration, /for select to anon, authenticated\s+using \(is_active\)/i)
  assert.match(migration, /for select to authenticated\s+using \(public\.is_admin\(\)\)/i)
  assert.doesNotMatch(migration, /grant execute on function public\.is_admin\(\) to anon/i)
})

test('hero poster reordering locks and rejects stale partial catalog order', () => {
  const orderingMigration = readFileSync(new URL('../supabase/migrations/202609140002_marketing_hero_poster_order_safety.sql', import.meta.url), 'utf8')
  assert.match(orderingMigration, /lock table public\.marketing_hero_posters in share row exclusive mode/i)
  assert.match(orderingMigration, /select count\(\*\) into v_total_count from public\.marketing_hero_posters/i)
  assert.match(orderingMigration, /v_total_count <> cardinality\(p_ids\)/i)
})
