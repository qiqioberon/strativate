import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DAYS_OF_WEEK,
  groupAvailabilityByDay,
  toAvailabilityPayload,
  validateAvailabilityDraft,
  type AvailabilityDraftRange,
} from '../lib/mentor/availability'
import { parseMentorInvitationInput } from '../lib/admin/mentor-invitation-input'
import { managedMentorName, managedMentorSetup, managedMentorTier } from '../lib/mentor/admin'
import type { ManagedMentor } from '../lib/supabase/database.types'

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

test('mentor invitation input requires a valid email and tier UUID on the server', () => {
  const tierId = '81000000-0000-0000-0000-000000000002'
  assert.deepEqual(parseMentorInvitationInput(' Mentor@Example.test ', ''), {
    error: 'Pilih tier mentor yang aktif.',
  })
  assert.deepEqual(parseMentorInvitationInput(' Mentor@Example.test ', 'not-a-tier-id'), {
    error: 'Pilih tier mentor yang aktif.',
  })
  assert.deepEqual(parseMentorInvitationInput('not-an-email', tierId), {
    error: 'Masukkan email mentor yang valid.',
  })
  assert.deepEqual(parseMentorInvitationInput(' Mentor@Example.test ', tierId), {
    email: 'mentor@example.test',
    tierId,
  })
})

test('admin mentor rows expose honest identity, tier, and setup labels', () => {
  const mentor: ManagedMentor = {
    user_id: 'mentor-id', email: 'mentor@example.test', first_name: 'Navira', last_name: 'Putri',
    username: 'navira', avatar_url: null, tier_id: null, tier_code: null, tier_name: null,
    timezone: 'Asia/Jakarta', mentor_setup_completed_at: null, created_at: '2026-09-13T00:00:00Z',
    availability_configured: false,
  }
  assert.equal(managedMentorName(mentor), 'Navira Putri')
  assert.equal(managedMentorTier(mentor), 'Tier belum ditentukan')
  assert.deepEqual(managedMentorSetup(mentor), { label: 'Menunggu pengaturan akun', tone: 'pending' })
  assert.equal(managedMentorName({ ...mentor, first_name: null, last_name: null }), 'navira')
  assert.equal(managedMentorName({ ...mentor, first_name: null, last_name: null, username: null }), 'mentor@example.test')
  assert.equal(managedMentorTier({ ...mentor, tier_name: 'Top Student' }), 'Top Student')
  assert.deepEqual(managedMentorSetup({ ...mentor, mentor_setup_completed_at: '2026-09-13T01:00:00Z' }), {
    label: 'Aktif', tone: 'active',
  })
})
