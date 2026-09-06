import { passwordError, usernameError } from '../auth/rules'

type Result<T> = { data: T; error: null } | { data: null; error: string }

type ProfilePayload = {
  first_name: string
  last_name: string | null
  username: string
}

type InstitutionPayload = {
  institution_id: string
  major_or_faculty: string | null
  cohort_year: number | null
}

type ReferralPayload = {
  referral_source_id: string | null
  referral_other_text: string | null
}

type InterestPayload = {
  interest_ids: string[]
  other_interest_text: string | null
}

function textMetadata(metadata: Record<string, unknown>, key: string): string {
  return typeof metadata[key] === 'string' ? metadata[key].trim() : ''
}

export function onboardingNameDefaults(
  profile: { first_name: string | null; last_name: string | null; username?: string | null },
  metadata: Record<string, unknown>,
) {
  if (profile.username) return { firstName: profile.first_name || '', lastName: profile.last_name || '' }
  const fullName = textMetadata(metadata, 'full_name').split(/\s+/u).filter(Boolean)
  const firstName = profile.first_name || textMetadata(metadata, 'given_name') || fullName[0] || ''
  const lastName = profile.last_name || textMetadata(metadata, 'family_name') || fullName.slice(1).join(' ')
  return { firstName, lastName }
}

export function profilePayload(input: {
  firstName: string
  lastName: string
  username: string
  password: string
  confirmation: string
  passwordRequired: boolean
}): Result<ProfilePayload> {
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const username = input.username.trim()
  if (!firstName || firstName.length > 100 || lastName.length > 100) {
    return { data: null, error: 'Isi nama depan yang valid.' }
  }
  const invalid = usernameError(username) || passwordError(input.password, input.confirmation, input.passwordRequired)
  if (invalid) return { data: null, error: invalid }
  return { data: { first_name: firstName, last_name: lastName || null, username }, error: null }
}

export function institutionPayload(input: {
  institutionId: string
  majorOrFaculty: string
  cohortYear: string
}, currentYear = new Date().getFullYear()): Result<InstitutionPayload> {
  const institutionId = input.institutionId.trim()
  const majorOrFaculty = input.majorOrFaculty.trim()
  const cohort = input.cohortYear.trim()
  if (!institutionId) return { data: null, error: 'Pilih institusi terlebih dahulu.' }
  if (majorOrFaculty.length > 150) return { data: null, error: 'Jurusan atau fakultas maksimal 150 karakter.' }
  const cohortYear = cohort === '' ? null : Number(cohort)
  if (cohortYear !== null && (!Number.isInteger(cohortYear) || cohortYear < 1950 || cohortYear > currentYear + 1)) {
    return { data: null, error: `Angkatan harus berupa tahun antara 1950 dan ${currentYear + 1}.` }
  }
  return {
    data: { institution_id: institutionId, major_or_faculty: majorOrFaculty || null, cohort_year: cohortYear },
    error: null,
  }
}

export function referralPayload(input: { referralId: string; otherText: string }): Result<ReferralPayload> {
  const referralId = input.referralId.trim()
  const otherText = input.otherText.trim()
  if ((!referralId && !otherText) || (referralId && otherText)) {
    return { data: null, error: 'Pilih tepat satu sumber informasi atau isi pilihan lainnya.' }
  }
  if (otherText.length > 500) return { data: null, error: 'Jawaban lainnya maksimal 500 karakter.' }
  return {
    data: { referral_source_id: referralId || null, referral_other_text: otherText || null },
    error: null,
  }
}

export function interestPayload(input: { interestIds: string[]; otherText: string }): Result<InterestPayload> {
  const interestIds = [...new Set(input.interestIds.map((id) => id.trim()).filter(Boolean))]
  const otherText = input.otherText.trim()
  if (interestIds.length === 0 && !otherText) return { data: null, error: 'Pilih setidaknya satu minat kompetisi.' }
  if (interestIds.length > 100) return { data: null, error: 'Terlalu banyak minat dipilih.' }
  if (otherText.length > 500) return { data: null, error: 'Minat lainnya maksimal 500 karakter.' }
  return { data: { interest_ids: interestIds, other_interest_text: otherText || null }, error: null }
}

export function normalizeInstitutionName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ')
}

export function exactInstitutionMatches<T extends { name: string; type: string }>(
  name: string,
  type: string,
  records: T[],
): T[] {
  const normalized = normalizeInstitutionName(name).normalize('NFC').toLowerCase()
  return records.filter((record) => record.type === type && normalizeInstitutionName(record.name).normalize('NFC').toLowerCase() === normalized)
}
