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
const review = read('app/onboarding/review/page.tsx')
const picker = read('components/onboarding/institution-picker.tsx')
const css = read('app/onboarding.css')
const layout = read('app/layout.tsx')

test('canonical persistence remains four steps while revision stages stay presentation-only', () => {
  assert.match(types, /export type CanonicalStep = 1 \| 2 \| 3 \| 4/)
  assert.match(types, /export type RevisionTarget = 'identity' \| 'institution' \| 'referral' \| 'interests'/)
  for (const stage of ['name-confirmation', 'name-edit', 'username', 'password', 'institution', 'major', 'cohort', 'referral', 'interests']) {
    assert.ok(types.includes("'" + stage + "'"), stage + ' visual stage must exist')
  }
  for (const step of [1, 2, 3, 4]) assert.ok(experience.includes('runCanonicalSave(' + step + ','), 'canonical Step ' + step + ' save must remain present')
  assert.doesNotMatch(experience, /runCanonicalSave\([5-9]/)
  assert.doesNotMatch(experience, /localStorage/)
  assert.match(page, /reviewReturnPath=\{revisionTarget \? '\/onboarding\/review' : null\}/)
})

test('wizard remains a small entry point instead of regressing into a giant form wizard', () => {
  assert.match(wizard, /OnboardingExperience/)
  assert.doesNotMatch(wizard, /<form|<input|<fieldset|save_onboarding_step|InstitutionPicker|PasswordInput/)
  assert.ok(wizard.split('\n').length < 15)
})

test('name username and password remain separate primary questions', () => {
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
})

test('identity micro-stages preserve existing password semantics and Step 1 authority', () => {
  assert.match(experience, /profilePayload\(\{ firstName, lastName, username, password: effectivePassword, confirmation: effectiveConfirmation, passwordRequired \}\)/)
  assert.match(experience, /profile\.registration_method === 'email' && !passwordSaved/)
  assert.match(experience, /passwordUpdateError && passwordUpdateError\.code !== 'same_password'/)
  assert.match(experience, /runCanonicalSave\(1, result\.data as Json\)/)
  assert.match(experience, /skipPassword/)
})

test('single-canvas shell remains intact and ambient composition responds to journey stage', () => {
  assert.match(shell, /onboarding-shell__main/)
  assert.match(shell, /onboarding-ambient/)
  assert.doesNotMatch(shell, /<aside|onboarding-shell__aside|onboarding-shell__content/)
  assert.match(experience, /data-atmosphere=\{atmosphere\}/)
  for (const atmosphere of ['welcome', 'identity', 'institution', 'referral', 'interests']) {
    assert.ok(css.includes("data-atmosphere='" + atmosphere + "'"), atmosphere + ' atmosphere must be styled')
  }
  assert.match(css, /:has\(\.onboarding-calendar-stage\)/)
  assert.match(css, /:has\(\.onboarding-review\)/)
})

test('progress remains lightweight database-agnostic and transition-synchronized', () => {
  const frame = read('components/onboarding/stage-frame.tsx')
  assert.match(frame, /role="progressbar"/)
  assert.doesNotMatch(frame, /Langkah|Akun|Institusi|Referensi|Minat/)
  assert.match(css, /onboarding-experience\[data-phase='exit'\][\s\S]*?data-state='current'/)
  assert.match(css, /onboarding-progress-settle/)
})

test('referral normal choices remain direct actions while Other keeps explicit text confirmation', () => {
  const referralStart = stages.indexOf('export function ReferralStage')
  const interestsStart = stages.indexOf('function interestSummary')
  const referralBlock = stages.slice(referralStart, interestsStart)
  assert.match(referralBlock, /onClick=\{\(\) => onChoose\(option\.id\)\}/)
  assert.match(experience, /async function saveReferralChoice/)
  assert.match(experience, /runCanonicalSave\(3, result\.data as Json\)/)
  assert.match(referralBlock, /selected === 'other'/)
  assert.match(referralBlock, /textarea/)
  assert.match(referralBlock, /onSubmit=\{onSubmitOther\}/)
})

test('interests remain database-driven and post-interest acknowledgement is intentionally general', () => {
  assert.match(page, /db\.from\('interests'\)[\s\S]*?eq\('is_active', true\)/)
  assert.match(stages, /interests\.map\(/)
  assert.match(stages, /type="checkbox"/)
  assert.match(stages, /Lanjutkan dengan \{selectedIds\.length\} pilihan/)
  assert.match(experience, /Sip, pilihanmu sudah tersimpan\./)
  assert.doesNotMatch(experience, /readableInterestAcknowledgement|selectedInterestNames/)
  assert.doesNotMatch(stages, /const interests = \[/)
})

test('master referral choices remain database-driven', () => {
  assert.match(page, /db\.from\('referral_sources'\)[\s\S]*?eq\('is_active', true\)/)
  assert.match(stages, /referrals\.map\(/)
  assert.doesNotMatch(stages, /TikTok|Instagram.*TikTok/)
})

test('missing institution alternative is a real secondary action while domain behavior remains unchanged', () => {
  assert.match(picker, /rpc\('search_institutions'/)
  assert.match(picker, /rpc\('submit_institution'/)
  assert.match(picker, /exactInstitutionMatches/)
  assert.match(picker, /role="combobox"/)
  assert.match(picker, /role="listbox"/)
  assert.match(picker, /aria-activedescendant/)
  assert.match(picker, /className="institution-create__action"/)
  assert.match(picker, /Ajukan “/)
  assert.match(picker, /<Plus aria-hidden="true"/)
  assert.doesNotMatch(picker, /className="onboarding-error"[^>]*>.*Ajukan/s)
})

test('option-card layout fixes the letter-by-letter wrapping root cause', () => {
  assert.match(css, /\.onboarding-answer-card\s*\{[\s\S]*?display: flex;/)
  assert.match(css, /\.onboarding-answer-card > span\s*\{[\s\S]*?min-width: 0;[\s\S]*?overflow-wrap: break-word;[\s\S]*?word-break: normal;/)
  assert.match(css, /\.onboarding-answer-card--check\s*\{[\s\S]*?display: flex;/)
  assert.match(css, /\.onboarding-answer-card--check > span\s*\{[\s\S]*?word-break: normal;/)
})

test('motion choreography keeps explicit lifecycle, stagger, integrated acknowledgement and no fake delays', () => {
  assert.match(experience, /setPhase\('exit'\)/)
  assert.match(experience, /setPhase\('enter'\)/)
  assert.match(experience, /onAnimationEnd=\{handleStageAnimationEnd\}/)
  assert.match(experience, /inert=\{phase === 'exit'\}/)
  assert.doesNotMatch(experience, /setTimeout|sleep\(/)
  assert.match(css, /onboarding-content-rise/)
  assert.match(css, /onboarding-choice-rise/)
  assert.match(css, /onboarding-ack-punctuation/)
  assert.match(css, /\.onboarding-transition-ack\s*\{[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/)
})

test('failed saves remain on the current stage and rapid writes are guarded', () => {
  assert.match(experience, /const busyRef = useRef\(false\)/)
  assert.match(experience, /if \(busyRef\.current \|\| phase !== 'idle'\) return/)
  assert.match(experience, /catch \(submitError\) \{\n\s+setError/)
})

test('Calendar is optional and now occurs before final review', () => {
  assert.match(calendar, /getGoogleConnectionStatus/)
  assert.match(calendar, /Satu pilihan sebelum pengecekan akhir/)
  assert.match(calendar, /Hubungkan Google Calendar/)
  assert.match(calendar, /href="\/onboarding\/review"/)
  assert.match(calendar, /Lewati, lanjut ke ringkasan/)
  assert.doesNotMatch(calendar, /href="\/auth\/continue"/)
  assert.doesNotMatch(calendar, /Semua sudah siap/)
})

test('review is the final checkpoint with safe section-specific revision and final continue', () => {
  assert.match(review, /Pengecekan akhir/)
  assert.match(review, /Sebelum masuk, periksa sebentar/)
  assert.match(review, /Revisi data/)
  for (const section of ['identity', 'institution', 'referral', 'interests']) {
    assert.ok(review.includes("reviseHref('" + section + "')"), section + ' revise link must exist')
  }
  assert.match(review, /href="\/auth\/continue"/)
  assert.match(review, /href="\/onboarding\/calendar"/)
  assert.doesNotMatch(review, /save_onboarding_step|onboarding_step\s*=/)
})

test('completed mentees can enter explicit revision mode without changing normal destination behavior', () => {
  assert.match(page, /account\.mentee\.onboarding_completed_at && params\.revisi === '1'/)
  assert.match(page, /if \(account\.mentee\.onboarding_completed_at && !revisionTarget\) redirect\(account\.destination\)/)
  assert.match(experience, /revisionMode/)
  assert.match(experience, /reviewReturnPath/)
  assert.match(experience, /Informasi studimu sudah diperbarui\./)
  assert.match(experience, /Pilihanmu sudah diperbarui\./)
})

test('onboarding styles remain responsive overflow-safe and reduced-motion aware', () => {
  assert.match(layout, /import '\.\/onboarding\.css'/)
  assert.match(css, /@media \(max-width: 640px\)/)
  assert.match(css, /@media \(max-width: 340px\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.doesNotMatch(css, /body\s*\{[^}]*overflow-x:\s*hidden/)
  assert.doesNotMatch(css, /html\s*\{[^}]*overflow-x:\s*hidden/)
  assert.doesNotMatch(css, /height:\s*800px/)
})
