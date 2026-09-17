import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const migrationPath = 'supabase/migrations/202609170003_private_mentoring_stakeholder_rules.sql'

test('forward migration separates topic review from lifecycle and protects audit history', () => {
  const sql = read(migrationPath)
  assert.match(sql, /topic_status[^\n]*needs_input[^\n]*pending_review[^\n]*confirmed/i)
  assert.match(sql, /private_mentoring_session_topic_events/i)
  assert.match(sql, /submit_private_mentoring_topic_request/i)
  assert.match(sql, /admin_resolve_private_mentoring_session_topic/i)
  assert.match(sql, /Session topic must be confirmed before scheduling/i)
  assert.match(sql, /completed[^\n]*cancelled/i)
})

test('five-or-more-session enrollments use an audited primary mentor while smaller packages remain flexible', () => {
  const sql = read(migrationPath)
  assert.match(sql, /primary_mentor_id/i)
  assert.match(sql, /private_mentoring_primary_mentor_changes/i)
  assert.match(sql, /purchased_sessions\s*>=\s*5/i)
  assert.match(sql, /admin_set_private_mentoring_primary_mentor/i)
  assert.match(sql, /Mentor tier does not match purchased package/i)
  assert.match(sql, /purchased_sessions\s*<\s*5/i)
})

test('Intensive fixed-price catalog participates in Shared Commerce and paid fulfillment', () => {
  const sql = read(migrationPath)
  assert.match(sql, /intensive_mentoring_entitlements/i)
  assert.match(sql, /intensive_mentoring_package/i)
  assert.match(sql, /intensive_mentoring_bundle/i)
  assert.match(sql, /intensive_mentoring_add_on/i)
  assert.match(sql, /pricing_mode\s*=\s*'fixed'/i)
  assert.match(sql, /fulfill_paid_intensive_mentoring_order/i)
  assert.match(sql, /order_item_id uuid not null unique/i)
})

test('mentee and admin UIs expose request-review-resolve flow instead of focus auto approval', () => {
  const mentee = read('components/dashboard/private-mentoring-sessions.tsx')
  const admin = read('components/admin/private-mentoring-enrollment-management.tsx')
  assert.match(mentee, /Apa yang ingin kamu bahas/i)
  assert.match(mentee, /submit_private_mentoring_topic_request/i)
  assert.match(mentee, /optional|opsional/i)
  assert.match(admin, /admin_resolve_private_mentoring_session_topic/i)
  assert.match(admin, /admin_set_private_mentoring_primary_mentor/i)
  assert.match(admin, /Change Mentor|Ganti mentor/i)
})

test('Calendar sync uses resolved topic and keeps patching the same event identity', () => {
  const calendar = read('lib/google-calendar/server.ts')
  const sync = read('lib/google-calendar/sync.ts')
  assert.match(calendar, /resolvedTopic/i)
  assert.match(calendar, /Strativate Private Mentoring/i)
  assert.match(sync, /method:\s*'PATCH'/)
  assert.match(sync, /eventId/i)
})
