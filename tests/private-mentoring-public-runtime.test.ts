import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => { assert.equal(existsSync(path), true, `${path} must exist`); return readFileSync(path, 'utf8') }

test('public Private Mentoring uses a focused server data boundary', () => {
  const server = read('lib/private-mentoring/server.ts')
  assert.match(server, /getPublicPrivateMentoring/)
  assert.match(server, /private_mentoring_programs/)
  assert.match(server, /private_mentoring_packages/)
  assert.match(server, /price_amount\s*\/\s*packageRow\.session_count|price_amount\s*\/\s*row\.session_count|Math\.round\(/)

  const home = read('app/page.tsx')
  const directory = read('app/program/page.tsx')
  const detail = read('app/program/[slug]/page.tsx')
  for (const source of [home, directory, detail]) assert.match(source, /getPublicPrivateMentoring/)
})

test('Private Mentoring detail renders real packages while Intensive Mentoring can retain unavailable copy', () => {
  const detail = read('components/programs/program-detail.tsx')
  assert.match(detail, /packages/i)
  assert.match(detail, /pricePerSession/)
  assert.match(detail, /durationMinutes/)
  assert.match(detail, /maxParticipants/)
  assert.match(detail, /sessionFocuses/)
  assert.match(detail, /learningPaths/)
  assert.match(detail, /competitionCategories/)
  assert.match(detail, /Konsultasi via WhatsApp|Konsultasi dahulu/)
  assert.doesNotMatch(detail, /choose mentor|pilih mentor[^a-z]/i)
  assert.doesNotMatch(detail, /calendar slot|pilih jadwal/i)
})

test('static program source no longer owns Private Mentoring business content', () => {
  const source = read('lib/program-information.ts')
  assert.doesNotMatch(source, /'private-mentoring'\s*:\s*\{/)
  assert.match(source, /'intensive-mentoring'/)
})
