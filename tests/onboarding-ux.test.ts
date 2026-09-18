import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const wizard = read('components/onboarding/wizard.tsx')
const experience = read('components/onboarding/experience.tsx')
const stages = read('components/onboarding/stages.tsx')
const types = read('components/onboarding/types.ts')
const shell = read('components/onboarding/shell.tsx')
const page = read('app/onboarding/page.tsx')
const calendar = read('app/onboarding/calendar/page.tsx')
const picker = read('components/onboarding/institution-picker.tsx')
const css = read('app/onboarding.css')
const layout = read('app/layout.tsx')

test('canonical persistence remains four steps while the product experience uses granular visual stages', () => {
  assert.match(types, /export type CanonicalStep = 1 \| 2 \| 3 \| 4/)
  for (const stage of ['name-confirmation', 'name-edit', 'username', 'password', 'institution', 'major', 'cohort', 'referral', 'interests']) {
    assert.ok(types.includes("'" + stage + "'"), stage + ' visual stage must exist')
  }
  assert.match(types, /if \(step === 1\) return 'welcome'/)
  assert.match(types, /if \(step === 2\) return 'institution'/)
  assert.match(types, /if \(step === 3\) return 'referral'/)
  assert.match(types, /return 'interests'/)
  for (const step of [1, 2, 3, 4]) assert.match(experience, new RegExp('runCanonicalSave\\(' + step + ','))
  assert.doesNotMatch(experience, /runCanonicalSave\([5-9]/)
  assert.doesNotMatch(experience, /localStorage/)
})

test('wizard is only a small controller entry point instead of another giant form implementation', () => {
  assert.match(wizard, /OnboardingExperience/)
  assert.doesNotMatch(wizard, /<form|<input|<fieldset|save_onboarding_step|InstitutionPicker|PasswordInput/)
  assert.ok(wizard.split('\n').length < 15)
})

test('name username and password are separate primary questions', () => {
  const nameStart = stages.indexOf('export function NameEditStage')
  const usernameStart = stages.indexOf('export function UsernameStage')
  const passwordStart = stages.indexOf('export function PasswordStage')
  const institutionStart = stages.indexOf('export function InstitutionStage')
  const nameBlock = stages.slice(nameStart, usernameStart)
  const usernameBlock = stages.slice(usernameStart, passwordStart)
  const passwordBlock = stages.slice(passwordStart, institutionStart)

  assert.match(nameBlock, /Nama depan/)
  assert.match(nameBlock, /Nama belakang/)
  assert.doesNotMatch(nameBlock, /Nama pengguna|PasswordInput|InstitutionPicker/)

  assert.match(usernameBlock, /Nama pengguna/)
  assert.doesNotMatch(usernameBlock, /Nama depan|Nama belakang|PasswordInput|InstitutionPicker/)

  assert.match(passwordBlock, /PasswordInput/)
  assert.doesNotMatch(passwordBlock, /Nama pengguna|Nama depan|InstitutionPicker/)
  assert.match(passwordBlock, /Akun Google-mu sudah siap/)
  assert.match(passwordBlock, /Lewati/)
})

test('identity micro-stages save only at the canonical Step 1 boundary and preserve password semantics', () => {
  assert.match(experience, /profilePayload\(\{ firstName, lastName, username, password: effectivePassword, confirmation: effectiveConfirmation, passwordRequired \}\)/)
  assert.match(experience, /profile\.registration_method === 'email' && !passwordSaved/)
  assert.match(experience, /passwordUpdateError && passwordUpdateError\.code !== 'same_password'/)
  assert.match(experience, /runCanonicalSave\(1, result\.data as Json\)/)
  assert.match(experience, /skipPassword/)
})

test('shell is one immersive canvas with no permanent side panel or giant content card', () => {
  assert.match(shell, /onboarding-shell__main/)
  assert.match(shell, /onboarding-ambient/)
  assert.doesNotMatch(shell, /<aside|onboarding-shell__aside|onboarding-shell__content/)
  assert.doesNotMatch(css, /\.onboarding-shell__aside|\.onboarding-shell__content/)
  assert.doesNotMatch(css, /grid-template-columns:\s*minmax\(0,\s*680px\)/)
  assert.match(css, /\.onboarding-experience\s*\{[\s\S]*?width: min\(640px, 100%\)/)
})

test('progress is visual-stage based and does not expose canonical database step labels', () => {
  const frame = read('components/onboarding/stage-frame.tsx')
  assert.match(frame, /role="progressbar"/)
  assert.match(frame, /Array\.from\(\{ length: maximum \}/)
  assert.doesNotMatch(frame, /Langkah|Akun|Institusi|Referensi|Minat/)
  assert.doesNotMatch(stages, /Langkah [1-4] dari 4/)
})

test('referral normal choices are direct actions while Other keeps explicit text confirmation', () => {
  const referralStart = stages.indexOf('export function ReferralStage')
  const interestsStart = stages.indexOf('function interestSummary')
  const referralBlock = stages.slice(referralStart, interestsStart)
  assert.match(referralBlock, /onClick=\{\(\) => onChoose\(option\.id\)\}/)
  assert.match(experience, /async function saveReferralChoice/)
  assert.match(experience, /runCanonicalSave\(3, result\.data as Json\)/)
  assert.match(experience, /transitionTo\(\{ stage: 'interests' \}\)/)
  assert.match(referralBlock, /selected === 'other'/)
  assert.match(referralBlock, /textarea/)
  assert.match(referralBlock, /onSubmit=\{onSubmitOther\}/)
})

test('interests remain database-driven multi-select with state-reflecting CTA and graceful acknowledgement', () => {
  assert.match(page, /db\.from\('interests'\)[\s\S]*?eq\('is_active', true\)/)
  assert.match(stages, /interests\.map\(/)
  assert.match(stages, /type="checkbox"/)
  assert.match(stages, /Lanjutkan dengan \{selectedIds\.length\} pilihan/)
  assert.match(experience, /readableInterestAcknowledgement/)
  assert.doesNotMatch(stages, /const interests = \[/)
})

test('master referral choices remain database-driven', () => {
  assert.match(page, /db\.from\('referral_sources'\)[\s\S]*?eq\('is_active', true\)/)
  assert.match(stages, /referrals\.map\(/)
  assert.doesNotMatch(stages, /TikTok|Instagram.*TikTok/)
})

test('institution picker retains domain behavior and accessible keyboard combobox semantics', () => {
  assert.match(picker, /rpc\('search_institutions'/)
  assert.match(picker, /rpc\('submit_institution'/)
  assert.match(picker, /exactInstitutionMatches/)
  assert.match(picker, /role="combobox"/)
  assert.match(picker, /role="listbox"/)
  assert.match(picker, /aria-activedescendant/)
  assert.match(picker, /ArrowDown/)
  assert.match(picker, /ArrowUp/)
  assert.match(picker, /event\.key === 'Enter'/)
  assert.match(picker, /p_allow_duplicate: allowDuplicate/)
})

test('transition lifecycle has explicit exit and enter phases without artificial delays', () => {
  assert.match(experience, /type TransitionPhase/)
  assert.match(experience, /setPhase\('exit'\)/)
  assert.match(experience, /setPhase\('enter'\)/)
  assert.match(experience, /onAnimationEnd=\{handleStageAnimationEnd\}/)
  assert.match(experience, /inert=\{phase === 'exit'\}/)
  assert.doesNotMatch(experience, /setTimeout|sleep\(/)
  assert.match(css, /@keyframes onboarding-stage-exit/)
  assert.match(css, /translateY\(-10px\)/)
  assert.match(css, /@keyframes onboarding-stage-enter/)
  assert.match(css, /translateY\(14px\)/)
})

test('failed saves remain on the current stage and rapid writes are guarded', () => {
  assert.match(experience, /const busyRef = useRef\(false\)/)
  assert.match(experience, /if \(busyRef\.current \|\| phase !== 'idle'\) return/)
  assert.match(experience, /catch \(submitError\) \{\n\s+setError/)
})

test('calendar remains optional and completion uses already-collected data as a payoff', () => {
  assert.match(calendar, /getGoogleConnectionStatus/)
  assert.match(calendar, /Semua sudah siap/)
  assert.match(calendar, /institution\.data\.name/)
  assert.match(calendar, /major/)
  assert.match(calendar, /summarizeInterests/)
  assert.match(calendar, /Hubungkan Google Calendar/)
  assert.match(calendar, /Lewati sekarang/)
  assert.match(calendar, /href="\/auth\/continue"/)
  assert.doesNotMatch(calendar, /onboarding_completed_at\s*=/)
})

test('onboarding styles are isolated responsive overflow-safe and reduced-motion aware', () => {
  assert.match(layout, /import '\.\/onboarding\.css'/)
  assert.match(css, /@media \(max-width: 640px\)/)
  assert.match(css, /@media \(max-width: 340px\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /overflow-wrap: anywhere/)
  assert.doesNotMatch(css, /body\s*\{[^}]*overflow-x:\s*hidden/)
  assert.doesNotMatch(css, /html\s*\{[^}]*overflow-x:\s*hidden/)
  assert.doesNotMatch(css, /height:\s*800px/)
})
