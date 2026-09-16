import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const migrationPath = join(root, 'supabase/migrations/202609170001_mentor_public_profiles_expertise.sql')
const readMigration = () => readFileSync(migrationPath, 'utf8')
const count = (source: string, needle: string) => source.split(needle).length - 1

const expertiseSeeds = [
  ['Lintas kategori kompetisi', 'lintas-kategori-kompetisi'],
  ['Business Plan', 'business-plan'],
  ['Business Case', 'business-case'],
  ['Marketing', 'marketing'],
  ['Finance', 'finance'],
  ['Economics', 'economics'],
  ['Accounting', 'accounting'],
  ['Proposal Development', 'proposal-development'],
] as const

test('mentor public domain migration defines normalized tables and security RPCs', () => {
  assert.equal(existsSync(migrationPath), true, 'mentor public domain migration must exist')
  const sql = readMigration()
  for (const token of [
    'create table public.mentor_public_profiles',
    'create table public.mentor_public_achievements',
    'create table public.mentor_expertise',
    'create table public.mentor_public_profile_expertise',
    'save_my_mentor_public_profile',
    'admin_upsert_mentor_expertise',
    'admin_reorder_mentor_expertise',
    'admin_delete_mentor_expertise',
    'admin_ensure_mentor_public_profile',
    'admin_set_mentor_publication',
    'list_public_mentors',
  ]) assert.ok(sql.includes(token), `missing migration contract: ${token}`)
  assert.match(sql, /mentor_public_profiles enable row level security/i)
  assert.match(sql, /mentor_public_achievements enable row level security/i)
  assert.match(sql, /mentor_expertise enable row level security/i)
  assert.match(sql, /mentor_public_profile_expertise enable row level security/i)
})

test('expertise seed uses the exact approved eight stable labels and slugs', () => {
  assert.equal(existsSync(migrationPath), true, 'mentor public domain migration must exist')
  const sql = readMigration()
  for (const [name, slug] of expertiseSeeds) {
    assert.equal(count(sql, `'${name}'`), 1, `expected one expertise seed label for ${name}`)
    assert.equal(count(sql, `'${slug}'`), 1, `expected one expertise seed slug for ${slug}`)
  }
})

test('migration never seeds mentor people and every public profile belongs to a mentor account', () => {
  assert.equal(existsSync(migrationPath), true, 'mentor public domain migration must exist')
  const sql = readMigration()
  assert.doesNotMatch(sql, /mentor_public_roster_seed/i)
  assert.doesNotMatch(sql, /insert\s+into\s+public\.mentor_public_profiles[\s\S]{0,1500}jsonb_to_recordset/i)
  assert.doesNotMatch(sql, /admin_link_mentor_public_profile/i)
  assert.doesNotMatch(sql, /Navira Putri|Safira Aulia|Aqil Drajat/i)
  assert.match(sql, /mentor_user_id\s+uuid\s+not null\s+unique\s+references\s+public\.mentor_profiles\(user_id\)\s+on delete cascade/i)
  assert.match(sql, /publication_status\s+text\s+not null\s+default\s+'draft'/i)
  assert.match(sql, /values\s*\(p_user_id,\s*v_slug,\s*v_name,\s*v_tier_id,\s*'draft'/i)
})

test('public mentor RPC explicitly returns public fields only', () => {
  assert.equal(existsSync(migrationPath), true, 'mentor public domain migration must exist')
  const sql = readMigration()
  const start = sql.indexOf('create function public.list_public_mentors')
  assert.notEqual(start, -1)
  const returnsStart = sql.indexOf('returns table', start)
  const languageStart = sql.indexOf('language ', returnsStart)
  assert.ok(returnsStart > start && languageStart > returnsStart)
  const signature = sql.slice(returnsStart, languageStart).toLowerCase()
  assert.doesNotMatch(signature, /email|whatsapp|mentor_user_id|auth_|timezone|is_active/)
  for (const field of ['public_slug', 'display_name', 'tier_name', 'headline', 'linkedin_url', 'short_bio', 'portrait_asset_key', 'portrait_url', 'photo_status', 'achievements', 'expertise']) {
    assert.ok(signature.includes(field), `public RPC must return ${field}`)
  }
})
