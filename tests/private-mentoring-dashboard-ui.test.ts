import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => { assert.equal(existsSync(path), true, `${path} must exist`); return readFileSync(path, 'utf8') }

test('mentee dashboard exposes seeded focus selection and confirmed schedule as read-only operational data', () => {
  const component = read('components/dashboard/private-mentoring-sessions.tsx')
  assert.match(component, /sessionFocuses/)
  assert.match(component, /set_private_mentoring_session_focus/)
  assert.match(component, /scheduledStartAt|scheduled_start_at/)
  assert.match(component, /mentorName|mentor_name/)
  assert.doesNotMatch(component, /assign.?mentor|set.?schedule|calendar.?slot/i)
})

test('legacy mentee self-scheduling controls are removed from dashboard client', () => {
  const dashboard = read('app/dashboard/dashboard-client.tsx')
  assert.doesNotMatch(dashboard, /Jadwalkan sesi/)
  assert.doesNotMatch(dashboard, /Konfirmasi Kam, 27 Agu/)
  assert.doesNotMatch(dashboard, /onBook=/)
  assert.match(dashboard, /PrivateMentoringSessions/)
})
