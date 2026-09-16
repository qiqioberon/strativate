import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const load = async () => import('../lib/private-mentoring/mentee-availability.ts').catch(() => null)

const mentors = [
  {
    mentorId: 'm1',
    mentorName: 'Muhammad Aqil',
    tierId: 'tier-1',
    tierName: 'Level 1',
    timezone: 'Asia/Jakarta',
    weekStartDate: '2026-09-14',
    availability: [
      { start: '2026-09-18T02:00:00.000Z', end: '2026-09-18T04:00:00.000Z' },
      { start: '2026-09-18T07:00:00.000Z', end: '2026-09-18T09:00:00.000Z' },
      { start: '2026-09-19T02:00:00.000Z', end: '2026-09-19T04:00:00.000Z' },
    ],
  },
  {
    mentorId: 'm2',
    mentorName: 'Dinda',
    tierId: 'tier-2',
    tierName: 'Level 2',
    timezone: 'Asia/Jakarta',
    weekStartDate: '2026-09-14',
    availability: [
      { start: '2026-09-18T03:00:00.000Z', end: '2026-09-18T06:00:00.000Z' },
      { start: '2026-09-21T02:00:00.000Z', end: '2026-09-21T05:00:00.000Z' },
    ],
  },
]

const slot = (mentorId: string, mentorName: string, start: string, end: string) => ({
  mentorId,
  mentorName,
  timezone: 'Asia/Jakarta',
  start,
  end,
})

const slots = [
  slot('m1', 'Muhammad Aqil', '2026-09-18T02:00:00.000Z', '2026-09-18T03:15:00.000Z'),
  slot('m1', 'Muhammad Aqil', '2026-09-18T07:00:00.000Z', '2026-09-18T08:15:00.000Z'),
  slot('m2', 'Dinda', '2026-09-18T03:00:00.000Z', '2026-09-18T04:15:00.000Z'),
  slot('m2', 'Dinda', '2026-09-21T02:00:00.000Z', '2026-09-21T03:15:00.000Z'),
]

test('mentee discovery only represents mentor dates backed by final bookable slots', async () => {
  const mod = await load(); assert.ok(mod)
  const result = mod.buildMenteeAvailabilityMentors({ mentors, slots })
  const aqil = result.find((mentor: { mentorId: string }) => mentor.mentorId === 'm1')
  assert.ok(aqil)
  assert.deepEqual(aqil.days.map((day: { dateKey: string }) => day.dateKey), ['2026-09-18'])
  assert.equal(aqil.days[0].ranges.length, 2)
  assert.equal(aqil.days[0].slots.length, 2)
})

test('display ranges are derived from final slots so conflicts split raw availability', async () => {
  const mod = await load(); assert.ok(mod)
  const mentor = {
    mentorId: 'm4',
    mentorName: 'Split Range',
    tierId: 'tier-1',
    tierName: 'Level 1',
    timezone: 'Asia/Jakarta',
    weekStartDate: '2026-09-14',
    availability: [{ start: '2026-09-18T02:00:00.000Z', end: '2026-09-18T06:00:00.000Z' }],
  }
  const result = mod.buildMenteeAvailabilityMentors({
    mentors: [mentor],
    slots: [
      slot('m4', 'Split Range', '2026-09-18T02:00:00.000Z', '2026-09-18T03:15:00.000Z'),
      slot('m4', 'Split Range', '2026-09-18T02:15:00.000Z', '2026-09-18T03:30:00.000Z'),
      slot('m4', 'Split Range', '2026-09-18T04:00:00.000Z', '2026-09-18T05:15:00.000Z'),
    ],
  })
  assert.deepEqual(result[0].days[0].ranges, [
    { start: '2026-09-18T02:00:00.000Z', end: '2026-09-18T03:30:00.000Z' },
    { start: '2026-09-18T04:00:00.000Z', end: '2026-09-18T05:15:00.000Z' },
  ])
})

test('raw availability with zero valid slots never makes a mentor or date available', async () => {
  const mod = await load(); assert.ok(mod)
  const result = mod.buildMenteeAvailabilityMentors({ mentors: [mentors[0]], slots: [] })
  assert.deepEqual(result, [])
})

test('mentor name and canonical tier filters return only matching mentors', async () => {
  const mod = await load(); assert.ok(mod)
  const available = mod.buildMenteeAvailabilityMentors({ mentors, slots })
  assert.deepEqual(
    mod.filterMenteeAvailability(available, { mentorQuery: 'aqil', tierId: '', date: '', timeStart: '', timeEnd: '' }).map((mentor: { mentorId: string }) => mentor.mentorId),
    ['m1'],
  )
  assert.deepEqual(
    mod.filterMenteeAvailability(available, { mentorQuery: '', tierId: 'tier-2', date: '', timeStart: '', timeEnd: '' }).map((mentor: { mentorId: string }) => mentor.mentorId),
    ['m2'],
  )
})

test('date and desired time filters are evaluated against final appointment slots', async () => {
  const mod = await load(); assert.ok(mod)
  const available = mod.buildMenteeAvailabilityMentors({ mentors, slots })
  assert.deepEqual(
    mod.filterMenteeAvailability(available, { mentorQuery: '', tierId: '', date: '2026-09-21', timeStart: '09:00', timeEnd: '11:00' }).map((mentor: { mentorId: string }) => mentor.mentorId),
    ['m2'],
  )
  assert.deepEqual(
    mod.filterMenteeAvailability(available, { mentorQuery: '', tierId: '', date: '2026-09-18', timeStart: '10:00', timeEnd: '11:00' }),
    [],
  )
})

test('all four filters combine without falling back to unavailable mentors', async () => {
  const mod = await load(); assert.ok(mod)
  const available = mod.buildMenteeAvailabilityMentors({ mentors, slots })
  const result = mod.filterMenteeAvailability(available, {
    mentorQuery: 'din',
    tierId: 'tier-2',
    date: '2026-09-18',
    timeStart: '10:00',
    timeEnd: '12:00',
  })
  assert.deepEqual(result.map((mentor: { mentorId: string }) => mentor.mentorId), ['m2'])
})

test('timezone grouping follows the mentor local date across a UTC boundary', async () => {
  const mod = await load(); assert.ok(mod)
  const boundaryMentor = {
    mentorId: 'm3', mentorName: 'Boundary', tierId: 'tier-1', tierName: 'Level 1', timezone: 'Asia/Jakarta', weekStartDate: '2026-09-14',
    availability: [{ start: '2026-09-17T17:00:00.000Z', end: '2026-09-17T20:00:00.000Z' }],
  }
  const result = mod.buildMenteeAvailabilityMentors({
    mentors: [boundaryMentor],
    slots: [slot('m3', 'Boundary', '2026-09-17T17:30:00.000Z', '2026-09-17T18:45:00.000Z')],
  })
  assert.equal(result[0].days[0].dateKey, '2026-09-18')
})

test('two-week calendar is exactly current plus next ISO week and crosses year safely', async () => {
  const mod = await load(); assert.ok(mod)
  const dates = mod.buildTwoWeekDateKeys('2026-12-28')
  assert.equal(dates.length, 14)
  assert.deepEqual(dates.slice(0, 2), ['2026-12-28', '2026-12-29'])
  assert.deepEqual(dates.slice(-2), ['2027-01-09', '2027-01-10'])
})

test('stale detail refresh replaces the mentor snapshot or removes a mentor that lost its final slot', async () => {
  const mod = await load(); assert.ok(mod)
  const available = mod.buildMenteeAvailabilityMentors({ mentors, slots })
  const refreshed = mod.buildMenteeAvailabilityMentors({ mentors: [mentors[0]], slots: [slots[0]] })
  const replaced = mod.replaceMenteeMentorAvailability(available, 'm1', refreshed[0] ?? null)
  assert.equal(replaced.find((mentor: { mentorId: string }) => mentor.mentorId === 'm1')?.days[0].slots.length, 1)
  const removed = mod.replaceMenteeMentorAvailability(replaced, 'm1', null)
  assert.equal(removed.some((mentor: { mentorId: string }) => mentor.mentorId === 'm1'), false)
})

test('mentee UI keeps unavailable dates disabled and uses a native dialog for fresh ranges', () => {
  const source = readFileSync(new URL('../components/dashboard/mentor-availability-explorer.tsx', import.meta.url), 'utf8')
  assert.match(source, /disabled=\{!day/)
  assert.match(source, /is-available/)
  assert.match(source, /<dialog/)
  assert.match(source, /aria-labelledby="mentor-availability-dialog-title"/)
})
