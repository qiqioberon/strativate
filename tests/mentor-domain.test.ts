import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DAYS_OF_WEEK,
  groupAvailabilityByDay,
  toAvailabilityPayload,
  validateAvailabilityDraft,
  type AvailabilityDraftRange,
} from '../lib/mentor/availability'

const range = (
  key: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
): AvailabilityDraftRange => ({ key, dayOfWeek, startTime, endTime })

test('availability payload uses ISO weekday order and removes client-only keys', () => {
  assert.deepEqual(DAYS_OF_WEEK, [
    { value: 1, label: 'Senin' },
    { value: 2, label: 'Selasa' },
    { value: 3, label: 'Rabu' },
    { value: 4, label: 'Kamis' },
    { value: 5, label: 'Jumat' },
    { value: 6, label: 'Sabtu' },
    { value: 7, label: 'Minggu' },
  ])
  assert.deepEqual(
    toAvailabilityPayload([
      range('saturday-afternoon', 6, '12:00', '14:00'),
      range('monday-evening', 1, '18:00', '21:00'),
      range('saturday-morning', 6, '09:00', '12:00'),
    ]),
    [
      { day_of_week: 1, start_time: '18:00', end_time: '21:00' },
      { day_of_week: 6, start_time: '09:00', end_time: '12:00' },
      { day_of_week: 6, start_time: '12:00', end_time: '14:00' },
    ],
  )
})

test('availability validation rejects malformed, reversed, and overlapping ranges', () => {
  assert.equal(
    validateAvailabilityDraft([range('bad-day', 0, '10:00', '11:00')]),
    'Pilih hari antara Senin dan Minggu.',
  )
  assert.equal(
    validateAvailabilityDraft([range('bad-clock', 1, '9:00', '11:00')]),
    'Gunakan format waktu 24 jam HH:mm.',
  )
  assert.equal(
    validateAvailabilityDraft([range('equal', 1, '11:00', '11:00')]),
    'Waktu selesai harus setelah waktu mulai.',
  )
  assert.equal(
    validateAvailabilityDraft([range('reversed', 1, '12:00', '11:00')]),
    'Waktu selesai harus setelah waktu mulai.',
  )
  assert.equal(
    validateAvailabilityDraft([
      range('first', 6, '09:00', '12:00'),
      range('overlap', 6, '11:30', '14:00'),
    ]),
    'Rentang waktu hari Sabtu saling tumpang tindih.',
  )
})

test('availability validation permits adjacent ranges and grouping includes empty days', () => {
  const adjacent = [
    range('first', 6, '09:00', '12:00'),
    range('second', 6, '12:00', '14:00'),
  ]
  assert.equal(validateAvailabilityDraft(adjacent), null)

  const grouped = groupAvailabilityByDay(adjacent)
  assert.deepEqual(grouped[1], [])
  assert.deepEqual(grouped[6], adjacent)
  assert.deepEqual(grouped[7], [])
  assert.deepEqual(Object.keys(grouped), ['1', '2', '3', '4', '5', '6', '7'])
})
