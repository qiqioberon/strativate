import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const wizard = readFileSync(new URL('../components/onboarding/wizard.tsx', import.meta.url), 'utf8')
const page = readFileSync(new URL('../app/onboarding/page.tsx', import.meta.url), 'utf8')
const calendar = readFileSync(new URL('../app/onboarding/calendar/page.tsx', import.meta.url), 'utf8')
const picker = readFileSync(new URL('../components/onboarding/institution-picker.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../app/onboarding.css', import.meta.url), 'utf8')
const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')

test('guided onboarding keeps visual stages separate from the four canonical persistence steps', () => {
  assert.match(wizard, /type CanonicalStep = 1 \| 2 \| 3 \| 4/)
  assert.match(wizard, /type VisualStage = 'welcome' \| 'identity' \| 'institution' \| 'major' \| 'cohort' \| 'referral' \| 'interests'/)
  assert.match(wizard, /if \(stage === 'institution' \|\| stage === 'major' \|\| stage === 'cohort'\) return 2/)
  assert.match(wizard, /db\.rpc\('save_onboarding_step'/)
  assert.match(wizard, /p_step: step/)
  assert.doesNotMatch(wizard, /localStorage/)
})

test('redesign preserves the existing onboarding payload helpers and password semantics', () => {
  assert.match(wizard, /profilePayload\(\{ firstName, lastName, username, password, confirmation, passwordRequired \}\)/)
  assert.match(wizard, /institutionPayload\(\{ institutionId: institution\?\.id \|\| '', majorOrFaculty: major, cohortYear: cohort \}\)/)
  assert.match(wizard, /referralPayload\(/)
  assert.match(wizard, /interestPayload\(\{ interestIds: selectedInterests \}\)/)
  assert.match(wizard, /profile\.registration_method === 'email' && !passwordSaved/)
  assert.match(wizard, /passwordUpdateError\.code !== 'same_password'/)
})

test('master referral and interest choices remain database-driven', () => {
  assert.match(page, /db\.from\('referral_sources'\).*eq\('is_active', true\)/s)
  assert.match(page, /db\.from\('interests'\).*eq\('is_active', true\)/s)
  assert.match(wizard, /referrals\.map\(/)
  assert.match(wizard, /interests\.map\(/)
  assert.doesNotMatch(wizard, /const interests = \[/)
  assert.doesNotMatch(wizard, /Business Case|Debat|UI\/UX|KTI/)
})

test('institution picker retains search, submission, duplicate confirmation and combobox semantics', () => {
  assert.match(picker, /rpc\('search_institutions'/)
  assert.match(picker, /rpc\('submit_institution'/)
  assert.match(picker, /exactInstitutionMatches/)
  assert.match(picker, /role="combobox"/)
  assert.match(picker, /role="listbox"/)
  assert.match(picker, /aria-activedescendant/)
})

test('calendar remains optional and continues through the authoritative destination flow', () => {
  assert.match(calendar, /getGoogleConnectionStatus/)
  assert.match(calendar, /Hubungkan Google Calendar/)
  assert.match(calendar, /Lewati sekarang/)
  assert.match(calendar, /href="\/auth\/continue"/)
  assert.doesNotMatch(calendar, /onboarding_completed_at\s*=/)
})

test('onboarding styles are isolated, responsive and reduced-motion safe', () => {
  assert.match(layout, /import '\.\/onboarding\.css'/)
  assert.match(css, /\.onboarding-shell/)
  assert.match(css, /@media \(max-width: 560px\)/)
  assert.match(css, /@media \(max-width: 340px\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(css, /overflow-wrap: anywhere/)
  assert.doesNotMatch(css, /body\s*\{[^}]*overflow-x:\s*hidden/s)
  assert.doesNotMatch(css, /height:\s*800px/)
  assert.doesNotMatch(css, /sleep\(/)
})

test('progress styling explicitly neutralizes the previous auth-shell progress treatment', () => {
  assert.match(css, /\.onboarding-progress li \{[\s\S]*?padding-top: 0;[\s\S]*?border-top: 0;/)
})
