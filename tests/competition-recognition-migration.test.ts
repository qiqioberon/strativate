import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/202609270001_competition_recognitions.sql', import.meta.url),
  'utf8',
)

test('competition recognition migration creates an unseeded dedicated collection', () => {
  assert.match(migration, /create table public\.competition_recognitions/i)
  assert.match(migration, /competition_name text not null/i)
  assert.match(migration, /logo_path text not null unique/i)
  assert.match(migration, /display_order integer not null default 0/i)
  assert.match(migration, /is_active boolean not null default true/i)
  assert.match(migration, /competition_recognitions_touch_updated_at/i)
  assert.match(migration, /competition_recognitions_public_order[\s\S]*where is_active/i)
  assert.match(migration, /\^recognition-logos\/\[A-Za-z0-9\]/i)
  assert.doesNotMatch(migration, /insert into public\.competition_recognitions/i)
})

test('competition recognition security keeps public reads active-only and mutations admin-only', () => {
  assert.match(migration, /alter table public\.competition_recognitions enable row level security/i)
  assert.match(migration, /for select to anon, authenticated[\s\S]*using \(is_active\)/i)
  assert.match(migration, /for (insert|update|delete) to authenticated[\s\S]*public\.is_admin\(\)/i)
  assert.match(migration, /revoke all on public\.competition_recognitions from anon, authenticated/i)
  assert.match(migration, /grant select \([\s\S]*\)\s+on public\.competition_recognitions to anon, authenticated/i)
  assert.match(migration, /grant all on public\.competition_recognitions to service_role/i)
  assert.doesNotMatch(migration, /insert into storage\.buckets/i)
})

test('recognition reorder requires the complete unique identity list', () => {
  assert.match(migration, /create function public\.reorder_competition_recognitions\(p_ids uuid\[\]\)/i)
  assert.match(migration, /if not public\.is_admin\(\)/i)
  assert.match(migration, /lock table public\.competition_recognitions in share row exclusive mode/i)
  assert.match(migration, /v_total_count <> cardinality\(p_ids\)/i)
  assert.match(migration, /v_matched_count <> cardinality\(p_ids\)/i)
  assert.match(migration, /count\(distinct input_id\)/i)
  assert.match(migration, /set display_order = ordering\.ordinality/i)
})

test('recognition storage policies allow only safe recognition-logo paths', () => {
  assert.match(migration, /drop policy if exists marketing_editorial_public_read on storage\.objects/i)
  assert.match(migration, /name like 'recognition-logos\/%'/i)
  assert.match(migration, /name not like '%\.\.%'/i)
  assert.match(migration, /name not like '%\/\/%'/i)
  assert.match(migration, /name ~\* '\\\.\(jpe\?g\|png\|webp\)\$'/i)
  assert.match(migration, /marketing_editorial_admin_insert[\s\S]*public\.is_admin\(\)/i)
  assert.match(migration, /marketing_editorial_admin_update[\s\S]*public\.is_admin\(\)/i)
  assert.match(migration, /marketing_editorial_admin_delete[\s\S]*public\.is_admin\(\)/i)
})
