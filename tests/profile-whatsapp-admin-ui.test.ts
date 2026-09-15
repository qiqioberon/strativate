import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

import { normalizeWhatsAppNumber, whatsAppNumberError } from '../lib/profile/whatsapp'

const read = (path: string) => { assert.equal(existsSync(path), true, `${path} must exist`); return readFileSync(path, 'utf8') }

test('WhatsApp normalization accepts the supported Indonesian input forms', () => {
  assert.equal(normalizeWhatsAppNumber('08123456789'), '+628123456789')
  assert.equal(normalizeWhatsAppNumber('628123456789'), '+628123456789')
  assert.equal(normalizeWhatsAppNumber('+62 812-3456-789'), '+628123456789')
  assert.equal(normalizeWhatsAppNumber(''), null)
  assert.match(whatsAppNumberError('0215551234') || '', /WhatsApp Indonesia/)
})

test('profile is read-only by default and exposes optional WhatsApp editing', () => {
  const source = read('components/auth/profile-form.tsx')
  assert.match(source, /profile-edit-button/)
  assert.match(source, /Edit profil/)
  assert.match(source, /whatsapp_number/)
  assert.match(source, /Tambahkan nomor WhatsApp/)
  assert.match(source, /normalizeWhatsAppNumber/)
  assert.match(source, /readOnly/)
})

test('admin Mentee listing uses a read-only detail projection with contact and onboarding data', () => {
  const source = read('components/admin/people.tsx')
  assert.match(source, /list_admin_mentees_page/)
  assert.match(source, /whatsapp_number/)
  assert.match(source, /mentee-detail-dialog/)
  assert.match(source, /Detail mentee · read-only/)
  assert.match(source, /institution_name/)
  assert.match(source, /referral_source_name/)
  assert.match(source, /interests/)
  assert.doesNotMatch(source, /\.from\('profiles'\)\.update/)
})

test('sortable table headers implement default, ascending, descending, default cycling', () => {
  const source = read('components/admin/sortable-table-header.tsx')
  assert.match(source, /nextSortDirection/)
  assert.match(source, /direction === 'asc'/)
  assert.match(source, /return null/)
  assert.match(source, /aria-sort/)
  assert.match(read('components/admin/master-options.tsx'), /SortableTableHeader/)
})

test('profile migration keeps admin detail read-only and normalizes WhatsApp in the database', () => {
  const migration = read('supabase/migrations/202609150003_profile_whatsapp_admin_mentee_sorting.sql')
  assert.match(migration, /add column if not exists whatsapp_number/)
  assert.match(migration, /normalize_whatsapp_number/)
  assert.match(migration, /profiles_whatsapp_number_format/)
  assert.match(migration, /list_admin_mentees_page/)
  assert.match(migration, /public\.is_admin\(\)/)
  assert.match(migration, /grant update \(whatsapp_number\) on public\.profiles to authenticated/)
  assert.doesNotMatch(migration, /profiles_update_admin|grant update .*auth\.users/i)
})
