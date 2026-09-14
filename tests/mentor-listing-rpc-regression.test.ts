import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync('supabase/migrations/202609140005_fix_managed_mentor_listing.sql', 'utf8')
const types = readFileSync('lib/supabase/database.types.ts', 'utf8')

test('managed mentor RPC casts auth email varchar to the declared text result type', () => {
  assert.match(migration, /coalesce\(u\.email::text, ''\)/)
  assert.match(migration, /concat_ws\(' ', p\.first_name, p\.last_name, p\.username, u\.email::text\)/)
})

test('managed mentor exact-count RPC mirrors account and setup filters and is typed for the client', () => {
  assert.match(migration, /create function public\.count_managed_mentors/)
  assert.match(migration, /p_account_status = 'active' and mp\.is_active/)
  assert.match(migration, /p_setup_status = 'complete' and p\.mentor_setup_completed_at is not null/)
  assert.match(migration, /grant execute on function public\.count_managed_mentors/)
  assert.match(types, /count_managed_mentors: \{ Args:/)
})
