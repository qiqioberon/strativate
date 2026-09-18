import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  buildMentorMenteeSummaries,
  buildMentorOverview,
  historyMentorSessions,
  mentorSessionStatusLabel,
  type MentorSessionRow,
} from '../lib/mentor/dashboard'

const read = (path: string) => readFileSync(path, 'utf8')

function session(overrides: Partial<MentorSessionRow> = {}): MentorSessionRow {
  return {
    session_id: 'session-1',
    enrollment_id: 'enrollment-1',
    mentee_id: 'mentee-1',
    mentee_name: 'Alya',
    mentee_email: 'alya@example.test',
    session_number: 1,
    purchased_sessions: 3,
    status: 'scheduled',
    focus_name: 'Case structuring',
    scheduled_start_at: '2026-09-17T02:00:00.000Z',
    scheduled_end_at: '2026-09-17T03:00:00.000Z',
    mentor_timezone: 'Asia/Jakarta',
    duration_minutes: 60,
    meeting_url: 'https://meet.google.com/example',
    google_event_id: 'event-1',
    google_ical_uid: 'ical-1',
    google_sync_status: 'synced',
    ...overrides,
  }
}

test('mentor dashboard route loads canonical server data and client removes demo operational constructs', () => {
  const route = read('app/mentor/dashboard/page.tsx')
  const client = [
    read('components/mentor/mentor-dashboard-client.tsx'),
    read('components/mentor/dashboard/mentor-overview.tsx'),
    read('components/mentor/dashboard/mentor-assignments.tsx'),
    read('components/mentor/dashboard/mentor-mentees.tsx'),
    read('components/mentor/dashboard/mentor-history.tsx'),
    read('components/mentor/dashboard/mentor-secondary-sections.tsx'),
    read('components/mentor/dashboard/mentor-detail-dialogs.tsx'),
  ].join('\n')
  const server = read('lib/mentor/dashboard-server.ts')

  assert.match(route, /loadMentorDashboardData/)
  assert.match(route, /MentorDashboardClient/)
  assert.match(server, /list_my_mentor_private_mentoring_sessions/)
  assert.match(server, /mentor_tiers/)
  assert.match(server, /mentor_availability_rules/)

  for (const forbidden of [/demo-store/, /DemoOrder/, /readOrders/, /readState/, /writeState/, /\+12%/, /Aqil Farrukh/, /Sarah Rahman/, /Dimas Prakoso/, /Terima penugasan/, />Tolak</]) {
    assert.doesNotMatch(client, forbidden)
  }
  assert.doesNotMatch(client, /label:\s*'Program'/)
})

test('mentor navigation and operational tables expose the requested real-data interactions', () => {
  const client = [
    read('components/mentor/mentor-dashboard-client.tsx'),
    read('components/mentor/dashboard/mentor-assignments.tsx'),
    read('components/mentor/dashboard/mentor-mentees.tsx'),
    read('components/mentor/dashboard/mentor-history.tsx'),
    read('components/mentor/dashboard/mentor-secondary-sections.tsx'),
    read('components/mentor/dashboard/mentor-detail-dialogs.tsx'),
  ].join('\n')
  for (const label of ['Ringkasan', 'Kalender', 'Penugasan', 'Peserta Saya', 'Ketersediaan', 'Riwayat Sesi', 'Notifikasi', 'Profil']) {
    assert.match(client, new RegExp(`label: '${label}'`))
  }
  assert.match(client, /SortableTableHeader/)
  assert.match(client, /TablePagination/)
  assert.match(client, /data-testid="mentor-assignment-table"/)
  assert.match(client, /data-testid="mentor-mentees-table"/)
  assert.match(client, /data-testid="mentor-history-table"/)
  assert.match(client, /<dialog/)
  assert.match(client, /Join Meeting/)
  assert.match(client, /Informasi mentor/)
  assert.match(client, /ProfileForm/)
})

test('overview derives real metrics without fabricated trends', () => {
  const rows = [
    session(),
    session({ session_id: 'session-2', session_number: 2, status: 'completed', scheduled_start_at: '2026-09-15T02:00:00.000Z', scheduled_end_at: '2026-09-15T03:00:00.000Z' }),
    session({ session_id: 'session-3', enrollment_id: 'enrollment-2', mentee_id: 'mentee-2', mentee_name: 'Bima', mentee_email: 'bima@example.test', status: 'scheduled', scheduled_start_at: '2026-09-16T06:00:00.000Z', scheduled_end_at: '2026-09-16T07:00:00.000Z' }),
  ]
  const result = buildMentorOverview(rows, new Date('2026-09-16T01:00:00.000Z'), 'Asia/Jakarta')
  assert.equal(result.sessionsToday, 1)
  assert.equal(result.upcomingSessions, 2)
  assert.equal(result.activeMentees, 2)
  assert.equal(result.completedThisMonth, 1)
  assert.deepEqual(result.upcoming.map(row => row.session_id), ['session-3', 'session-1'])
})

test('mentee summaries stay enrollment scoped and keep cancelled sessions distinct from completed progress', () => {
  const rows = [
    session({ session_id: 'session-a1', enrollment_id: 'enrollment-a', status: 'completed', scheduled_start_at: '2026-09-10T02:00:00.000Z' }),
    session({ session_id: 'session-a2', enrollment_id: 'enrollment-a', session_number: 2, status: 'scheduled' }),
    session({ session_id: 'session-b1', enrollment_id: 'enrollment-b', mentee_id: 'mentee-1', status: 'cancelled', scheduled_start_at: '2026-09-11T02:00:00.000Z', meeting_url: null }),
  ]
  const summaries = buildMentorMenteeSummaries(rows, new Date('2026-09-16T00:00:00.000Z'))
  assert.equal(summaries.length, 2)
  const first = summaries.find(item => item.enrollmentId === 'enrollment-a')!
  assert.equal(first.completedSessions, 1)
  assert.equal(first.progressSessions, 2)
  assert.equal(first.nextSession?.session_id, 'session-a2')
  const second = summaries.find(item => item.enrollmentId === 'enrollment-b')!
  assert.equal(second.cancelledSessions, 1)
  assert.equal(second.completedSessions, 0)
})

test('history contains only completed and cancelled records and labels cancellation correctly', () => {
  const rows = [
    session({ session_id: 'scheduled' }),
    session({ session_id: 'completed', status: 'completed', scheduled_start_at: '2026-09-10T02:00:00.000Z' }),
    session({ session_id: 'cancelled', status: 'cancelled', scheduled_start_at: '2026-09-11T02:00:00.000Z', meeting_url: null }),
  ]
  const history = historyMentorSessions(rows)
  assert.deepEqual(history.map(row => row.session_id), ['cancelled', 'completed'])
  assert.equal(mentorSessionStatusLabel(history[0].status), 'Dibatalkan')
  assert.equal(mentorSessionStatusLabel(history[1].status), 'Selesai')
})

test('mentor projection remains server-side isolated and availability layout is responsive without changing save semantics', () => {
  const migration = read('supabase/migrations/202609160001_private_mentoring_session_cancellation.sql')
  const availability = read('components/mentor/availability-editor.tsx')
  const css = read('app/mentor/dashboard/mentor-operations.css')
  const functionStart = migration.indexOf('create or replace function public.list_my_mentor_private_mentoring_sessions()')
  const functionBody = migration.slice(functionStart, migration.indexOf('create or replace function public.list_admin_private_mentoring_calendar_sessions', functionStart))

  assert.match(functionBody, /where s\.mentor_id = auth\.uid\(\)/)
  assert.match(availability, /save_mentor_availability/)
  assert.match(availability, /validateAvailabilityDraft/)
  assert.match(css, /\.mentor-availability-editor\.mentor \.availability-week\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*?\.mentor-availability-editor\.mentor \.availability-week[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  assert.match(css, /\.mentor-ops-table\s*\{[\s\S]*?min-width:/)
})
