import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('mentee availability dialog is explicitly centered after global CSS resets', () => {
  const css = read('../app/mentee-mentor-availability.css')
  const rule = css.match(/\.mentee-availability-dialog\s*\{([\s\S]*?)\}/)?.[1] ?? ''

  assert.match(rule, /position:\s*fixed/)
  assert.match(rule, /inset:\s*0/)
  assert.match(rule, /margin:\s*auto/)
})

test('date detail revalidation scopes availability work to the clicked mentor date', () => {
  const explorer = read('../components/dashboard/mentor-availability-explorer.tsx')
  const route = read('../app/api/mentee/mentor-availability/route.ts')
  const server = read('../lib/private-mentoring/mentee-availability-server.ts')

  assert.match(explorer, /date=\$\{encodeURIComponent\(dateKey\)\}/)
  assert.match(route, /getMenteeMentorAvailability\(\{ mentorId, date: date \|\| undefined \}\)/)
  assert.match(server, /options: \{ mentorId\?: string; date\?: string \} = \{\}/)
  assert.match(server, /if \(options\.date && dateKey !== options\.date\) return \[\]/)
})

test('date-scoped refresh replaces only the clicked day and preserves the rest of the mentor calendar', async () => {
  const mod = await import('../lib/private-mentoring/mentee-availability.ts')
  const mentor = {
    mentorId: 'mentor-1',
    mentorName: 'Mentor One',
    tierId: 'tier-1',
    tierName: 'Level 1',
    timezone: 'Asia/Jakarta',
    weekStartDate: '2026-09-14',
    days: [
      { dateKey: '2026-09-18', ranges: [{ start: '2026-09-18T02:00:00.000Z', end: '2026-09-18T04:00:00.000Z' }], slots: [{ start: '2026-09-18T02:00:00.000Z', end: '2026-09-18T03:15:00.000Z' }] },
      { dateKey: '2026-09-19', ranges: [{ start: '2026-09-19T02:00:00.000Z', end: '2026-09-19T04:00:00.000Z' }], slots: [{ start: '2026-09-19T02:00:00.000Z', end: '2026-09-19T03:15:00.000Z' }] },
    ],
  }
  const refreshed = {
    ...mentor,
    days: [{ dateKey: '2026-09-18', ranges: [{ start: '2026-09-18T03:00:00.000Z', end: '2026-09-18T05:00:00.000Z' }], slots: [{ start: '2026-09-18T03:00:00.000Z', end: '2026-09-18T04:15:00.000Z' }] }],
  }

  const replaced = mod.replaceMenteeMentorDayAvailability([mentor], mentor.mentorId, '2026-09-18', refreshed)
  assert.deepEqual(replaced[0].days.map(day => day.dateKey), ['2026-09-18', '2026-09-19'])
  assert.equal(replaced[0].days[0].slots[0].start, '2026-09-18T03:00:00.000Z')

  const removed = mod.replaceMenteeMentorDayAvailability(replaced, mentor.mentorId, '2026-09-18', null)
  assert.deepEqual(removed[0].days.map(day => day.dateKey), ['2026-09-19'])
})
