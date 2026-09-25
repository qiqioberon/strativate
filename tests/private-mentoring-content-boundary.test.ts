import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => {
  assert.equal(existsSync(path), true, `${path} must exist`)
  return readFileSync(path, 'utf8')
}

test('Private Mentoring marketing/editorial truth is static frontend content', () => {
  const editorial = read('lib/program-information.ts')
  assert.match(editorial, /'private-mentoring'\s*:\s*\{/)
  assert.match(editorial, /title:\s*'Private Mentoring'/)
  assert.match(editorial, /shortDescription:\s*'Flexible mentoring/)
  assert.match(editorial, /kicker:\s*'Flexible, focused sessions'/)
  assert.match(editorial, /audience:/)
  assert.match(editorial, /highlights:\s*\[/)
  assert.match(editorial, /journey:\s*\[/)

  const services = read('lib/content/services.ts')
  assert.match(services, /id:\s*'private-mentoring'[\s\S]*Flexible mentoring for individuals or small teams/)
})

test('homepage and program directory do not query the Private Mentoring catalog for marketing copy', () => {
  for (const path of ['app/page.tsx', 'components/marketing/home-page.tsx', 'app/program/page.tsx']) {
    const source = read(path)
    assert.doesNotMatch(source, /getPublicPrivateMentoring(?:Catalog)?/)
    assert.doesNotMatch(source, /private-mentoring\/server/)
  }
})

test('public Private Mentoring server boundary exposes catalog only', () => {
  const source = read('lib/private-mentoring/server.ts')
  assert.match(source, /getPublicPrivateMentoringCatalog/)
  for (const table of [
    'private_mentoring_packages',
    'private_mentoring_learning_paths',
    'private_mentoring_session_focuses',
    'competition_categories',
    'mentor_tiers',
  ]) assert.match(source, new RegExp(table))
  for (const obsolete of ['private_mentoring_programs', 'private_mentoring_highlights', 'private_mentoring_journey_steps']) {
    assert.doesNotMatch(source, new RegExp(obsolete))
  }
  assert.doesNotMatch(source, /shortDescription|kicker|audience|journeySteps|highlights/)
})

test('Private Mentoring detail combines static editorial with DB-backed catalog', () => {
  const page = read('app/program/[slug]/page.tsx')
  assert.match(page, /getProgramEditorialBySlug/)
  assert.match(page, /getPublicPrivateMentoringCatalog/)
  assert.match(page, /privateMentoringCatalog=/)

  const detail = read('components/programs/program-detail.tsx')
  assert.match(detail, /program:\s*ProgramEditorial/)
  assert.match(detail, /privateMentoringCatalog/)
  assert.match(detail, /learningPaths/)
  assert.match(detail, /sessionFocuses/)
  assert.match(detail, /competitionCategories/)
  assert.match(detail, /packages/)
})

test('a forward-only corrective migration removes obsolete Private Mentoring CMS objects', () => {
  const migration = read('supabase/migrations/202609140011_private_mentoring_content_boundary.sql')
  assert.match(migration, /create or replace function public\.resolve_commerce_item/i)
  assert.doesNotMatch(migration, /join public\.private_mentoring_programs/i)
  assert.match(migration, /drop column(?: if exists)? program_id/i)
  assert.match(migration, /drop table(?: if exists)? public\.private_mentoring_journey_steps/i)
  assert.match(migration, /drop table(?: if exists)? public\.private_mentoring_highlights/i)
  assert.match(migration, /drop table(?: if exists)? public\.private_mentoring_programs/i)
})
