import assert from 'node:assert/strict'
import test from 'node:test'
import {
  institutionPayload,
  interestPayload,
  exactInstitutionMatches,
  normalizeInstitutionName,
  onboardingNameDefaults,
  profilePayload,
  referralPayload,
} from '../lib/onboarding/rules'

test('Google name defaults prefer saved profile fields and split full-name metadata as fallback', () => {
  assert.deepEqual(
    onboardingNameDefaults(
      { first_name: 'Saved', last_name: null },
      { given_name: 'Google', family_name: 'Family', full_name: 'Fallback Person' },
    ),
    { firstName: 'Saved', lastName: 'Family' },
  )
  assert.deepEqual(
    onboardingNameDefaults(
      { first_name: null, last_name: null },
      { full_name: '  Aqil   Pratama Putra  ' },
    ),
    { firstName: 'Aqil', lastName: 'Pratama Putra' },
  )
})

test('profile payload validates email passwords but lets Google accounts omit them', () => {
  assert.equal(profilePayload({ firstName: 'Aqil', lastName: '', username: 'aqil_26', password: '', confirmation: '', passwordRequired: true }).data, null)
  assert.deepEqual(
    profilePayload({ firstName: ' Aqil ', lastName: ' Putra ', username: 'aqil_26', password: '', confirmation: '', passwordRequired: false }),
    { data: { first_name: 'Aqil', last_name: 'Putra', username: 'aqil_26' }, error: null },
  )
  assert.match(profilePayload({ firstName: 'Aqil', lastName: '', username: 'aq', password: 'password-2026', confirmation: 'password-2026', passwordRequired: false }).error || '', /Nama pengguna/)
})

test('an intentionally cleared surname stays blank after saved onboarding reload', () => {
  assert.deepEqual(onboardingNameDefaults({ first_name: 'Edited', last_name: null, username: 'saved_user' }, { family_name: 'Original', full_name: 'Old Original' }), { firstName: 'Edited', lastName: '' })
})

test('institution payload preserves an exact selected id and validates a reasonable optional cohort', () => {
  assert.deepEqual(
    institutionPayload({ institutionId: 'school-id', majorOrFaculty: ' Teknik Industri ', cohortYear: '2026' }, 2026),
    { data: { institution_id: 'school-id', major_or_faculty: 'Teknik Industri', cohort_year: 2026 }, error: null },
  )
  assert.deepEqual(
    institutionPayload({ institutionId: 'school-id', majorOrFaculty: '', cohortYear: '' }, 2026).data,
    { institution_id: 'school-id', major_or_faculty: null, cohort_year: null },
  )
  assert.match(institutionPayload({ institutionId: '', majorOrFaculty: '', cohortYear: '2026' }, 2026).error || '', /institusi/i)
  assert.match(institutionPayload({ institutionId: 'school-id', majorOrFaculty: '', cohortYear: '2028' }, 2026).error || '', /angkatan/i)
})

test('referral payload requires one master choice or one custom response', () => {
  assert.deepEqual(referralPayload({ referralId: 'referral-id', otherText: '' }), {
    data: { referral_source_id: 'referral-id', referral_other_text: null },
    error: null,
  })
  assert.deepEqual(referralPayload({ referralId: '', otherText: ' Seminar kampus ' }).data, {
    referral_source_id: null,
    referral_other_text: 'Seminar kampus',
  })
  assert.ok(referralPayload({ referralId: 'referral-id', otherText: 'Teman lain' }).error)
})

test('interest payload accepts only master selections and ignores legacy custom text', () => {
  const legacyInput = { interestIds: ['one', 'two', 'one'], otherText: ' Product Design ' }
  assert.deepEqual(interestPayload(legacyInput), {
    data: { interest_ids: ['one', 'two'] },
    error: null,
  })
  assert.match(interestPayload({ ...legacyInput, interestIds: [] }).error || '', /minat/i)
  assert.match(interestPayload({ ...legacyInput, interestIds: [' ', ''] }).error || '', /minat/i)
})

test('institution names are trimmed and repeated whitespace is collapsed before submission', () => {
  assert.equal(normalizeInstitutionName('  Universitas\t Indonesia  '), 'Universitas Indonesia')
})

test('duplicate confirmation is limited to same-type exact normalized institution matches', () => {
  const records = [
    { id: 'one', name: 'Universitas Indonesia', type: 'university' as const },
    { id: 'two', name: '  UNIVERSITAS   INDONESIA ', type: 'university' as const },
    { id: 'three', name: 'Universitas Indonesia', type: 'sma' as const },
    { id: 'four', name: 'Universitas Indonesia Timur', type: 'university' as const },
  ]
  assert.deepEqual(exactInstitutionMatches('universitas indonesia', 'university', records).map((record) => record.id), ['one', 'two'])
})
