import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

test('admin dashboard exposes a real Jadwal calendar while enrollment scheduling stays canonical and slot based', () => {
  const admin = read('app/admin/page.tsx')
  const enrollment = read('components/admin/private-mentoring-enrollment-management.tsx')
  assert.match(admin, /Jadwal/)
  assert.match(admin, /RoleCalendar/)
  assert.match(enrollment, /AdminScheduleDialog/)
  assert.doesNotMatch(enrollment, /type="datetime-local"/)
})

test('shared calendar detail exposes duration and timezone and keeps role-correct actions', () => {
  const calendar = read('components/calendar/role-calendar.tsx')
  assert.match(calendar, />Durasi</)
  assert.match(calendar, />Timezone</)
  assert.match(calendar, /Retry Google Sync/)
  assert.match(calendar, /Reset ke provider link/)\n  assert.match(calendar, /Join Meeting/)\n  assert.match(calendar, /calendar-legend/)
  assert.match(calendar, /Hubungi Admin via WhatsApp/)
  assert.match(calendar, /Atur availability/)
})

test('mentor calendar no longer renders the static demo CalendarPanel', () => {
  const mentor = read('components/mentor/mentor-dashboard-client.tsx')
  assert.match(mentor, /RoleCalendar/)
  assert.doesNotMatch(mentor, /function CalendarPanel\(\)/)
})

test('calendar integration keeps admin document width contained on mobile while tables scroll inside their wrappers', () => {
  const css = read('app/calendar-integration.css')
  assert.match(css, /\.admin-shell \.role-main[\s\S]*?min-width:\s*0/)
  assert.match(css, /\.admin-shell \.role-content[\s\S]*?min-width:\s*0/)
  assert.match(css, /\.admin-shell \.ops-table-wrap[\s\S]*?overflow-x:\s*auto/)
})

test('invalid Google authorization is presented as reconnect instead of a fresh-connect state', () => {
  const calendar = read('components/calendar/role-calendar.tsx')
  assert.match(calendar, /Reconnect Google Calendar/)
})

test('legacy admin session-management entry point delegates to the canonical enrollment scheduling flow', () => {
  const legacy = read('components/admin/private-mentoring-session-management.tsx')
  assert.match(legacy, /private-mentoring-enrollment-management/)
  assert.doesNotMatch(legacy, /datetime-local|admin_schedule_private_mentoring_session/)
})

test('mentee mentoring session cards format scheduled times in the stored mentor timezone', () => {
  const sessions = read('components/dashboard/private-mentoring-sessions.tsx')
  assert.match(sessions, /timeZone:\s*session\.mentorTimezone/)
})
