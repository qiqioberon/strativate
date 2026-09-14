import assert from 'node:assert/strict'
import test from 'node:test'

import {
  availabilityWeekOptions,
  dateInTimeZone,
} from '../lib/mentor/availability'
import {
  managedMentorAccountStatus,
  managedMentorAvailability,
  managedMentorSetup,
} from '../lib/mentor/admin'
import { destinationFor } from '../lib/auth/rules'

test('availability exposes only the current and next ISO week', () => {
  assert.deepEqual(availabilityWeekOptions('2026-09-14'), [
    {
      kind: 'current',
      weekStartDate: '2026-09-14',
      weekEndDate: '2026-09-20',
    },
    {
      kind: 'next',
      weekStartDate: '2026-09-21',
      weekEndDate: '2026-09-27',
    },
  ])

  assert.deepEqual(availabilityWeekOptions('2026-09-17'), [
    {
      kind: 'current',
      weekStartDate: '2026-09-14',
      weekEndDate: '2026-09-20',
    },
    {
      kind: 'next',
      weekStartDate: '2026-09-21',
      weekEndDate: '2026-09-27',
    },
  ])
})

test('availability resolves today in the mentor timezone before selecting a week', () => {
  assert.equal(
    dateInTimeZone(new Date('2026-09-13T18:30:00.000Z'), 'Asia/Jakarta'),
    '2026-09-14',
  )
  assert.equal(
    dateInTimeZone(new Date('2026-09-13T18:30:00.000Z'), 'UTC'),
    '2026-09-13',
  )
})

test('mentor account status is independent from setup completion', () => {
  assert.deepEqual(managedMentorAccountStatus({ is_active: true }), {
    label: 'Aktif',
    tone: 'active',
  })
  assert.deepEqual(managedMentorAccountStatus({ is_active: false }), {
    label: 'Nonaktif',
    tone: 'inactive',
  })
  assert.deepEqual(managedMentorSetup({ mentor_setup_completed_at: null }), {
    label: 'Belum selesai',
    tone: 'pending',
  })
  assert.deepEqual(managedMentorSetup({ mentor_setup_completed_at: '2026-09-14T00:00:00Z' }), {
    label: 'Selesai',
    tone: 'active',
  })
})

test('mentor availability summary distinguishes current and next week', () => {
  assert.equal(managedMentorAvailability({
    availability_current_week_configured: false,
    availability_next_week_configured: false,
  }), 'Belum diatur')
  assert.equal(managedMentorAvailability({
    availability_current_week_configured: true,
    availability_next_week_configured: false,
  }), 'Minggu ini')
  assert.equal(managedMentorAvailability({
    availability_current_week_configured: false,
    availability_next_week_configured: true,
  }), 'Minggu depan')
  assert.equal(managedMentorAvailability({
    availability_current_week_configured: true,
    availability_next_week_configured: true,
  }), 'Minggu ini & depan')
})

test('inactive mentors are routed away from setup and dashboard', () => {
  assert.equal(
    destinationFor(
      { role: 'mentor', mentor_setup_completed_at: '2026-09-14T00:00:00Z' },
      null,
      { is_active: false },
    ),
    '/auth/inactive',
  )
  assert.equal(
    destinationFor(
      { role: 'mentor', mentor_setup_completed_at: null },
      null,
      { is_active: false },
    ),
    '/auth/inactive',
  )
  assert.equal(
    destinationFor(
      { role: 'mentor', mentor_setup_completed_at: null },
      null,
      { is_active: true },
    ),
    '/auth/setup',
  )
  assert.equal(
    destinationFor(
      { role: 'mentor', mentor_setup_completed_at: '2026-09-14T00:00:00Z' },
      null,
      { is_active: true },
    ),
    '/mentor/dashboard',
  )
})
