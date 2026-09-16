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

test('legacy public roster migration never invents authenticated mentor ownership', () => {
  assert.equal(existsSync(migrationPath), true, 'mentor public domain migration must exist')
  const sql = readMigration()
  assert.match(sql, /legacy public roster remains unlinked/i)
  assert.match(sql, /mentor_user_id[^\n]*null/i)
  assert.doesNotMatch(sql, /join\s+auth\.users[\s\S]{0,300}legacy/i)
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
