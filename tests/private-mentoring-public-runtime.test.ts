import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => { assert.equal(existsSync(path), true, `${path} must exist`); return readFileSync(path, 'utf8') }

test('public Private Mentoring uses a catalog-only server data boundary', () => {
  const server = read('lib/private-mentoring/server.ts')
  assert.match(server, /getPublicPrivateMentoringCatalog/)
  assert.match(server, /private_mentoring_packages/)
  assert.match(server, /private_mentoring_learning_paths/)
  assert.match(server, /private_mentoring_session_focuses/)
  assert.match(server, /competition_categories/)
  assert.match(server, /Math\.round\(Number\(packageRow\.price_amount\) \/ packageRow\.session_count\)/)
  assert.doesNotMatch(server, /private_mentoring_programs|private_mentoring_highlights|private_mentoring_journey_steps/)

  const home = read('app/page.tsx')
  const directory = read('app/program/page.tsx')
  const detail = read('app/program/[slug]/page.tsx')
  assert.doesNotMatch(home, /getPublicPrivateMentoring/)
  assert.doesNotMatch(directory, /getPublicPrivateMentoring/)
  assert.match(detail, /getPublicPrivateMentoringCatalog/)
  assert.match(detail, /getProgramEditorialBySlug/)
})

test('Private Mentoring detail renders real DB catalog data inside the existing editorial page', () => {
  const detail = read('components/programs/program-detail.tsx')
  assert.match(detail, /program:\s*ProgramEditorial/)
  assert.match(detail, /privateMentoringCatalog/)
  assert.match(detail, /packages/i)
  assert.match(detail, /pricePerSession/)
  assert.match(detail, /durationMinutes/)
  assert.match(detail, /maxParticipants/)
  assert.match(detail, /sessionFocuses/)
  assert.match(detail, /learningPaths/)
  assert.match(detail, /competitionCategories/)
  assert.match(detail, /Talk to us first|Ask about packages on WhatsApp/)
  assert.doesNotMatch(detail, /choose mentor|pilih mentor[^a-z]/i)
  assert.doesNotMatch(detail, /calendar slot|pilih jadwal/i)
})

test('static program source owns Private Mentoring marketing content and Intensive Mentoring remains static', () => {
  const source = read('lib/program-information.ts')
  assert.match(source, /'private-mentoring'\s*:\s*\{/)
  assert.match(source, /'intensive-mentoring'\s*:\s*\{/)
  assert.match(source, /Learn with a suitable mentor/)
})
