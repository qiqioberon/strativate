import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const experience = read('components/onboarding/experience.tsx')
const stages = read('components/onboarding/stages.tsx')
const frame = read('components/onboarding/stage-frame.tsx')
const types = read('components/onboarding/types.ts')
const shell = read('components/onboarding/shell.tsx')
const shapeGrid = read('components/onboarding/shape-grid-background.tsx')
const motion = read('components/onboarding/motion.tsx')
const onboardingLayout = read('app/onboarding/layout.tsx')
const page = read('app/onboarding/page.tsx')
const calendar = read('app/onboarding/calendar/page.tsx')
const review = read('app/onboarding/review/page.tsx')
const picker = read('components/onboarding/institution-picker.tsx')
const css = read('app/onboarding.css')
const rootLayout = read('app/layout.tsx')

test('canonical persistence remains four steps while visual and route scenes stay presentation-only', () => {
  assert.match(types, /export type CanonicalStep = 1 \| 2 \| 3 \| 4/)
  assert.match(types, /export type RevisionTarget = 'identity' \| 'institution' \| 'referral' \| 'interests'/)
  assert.match(types, /export type OnboardingScene = VisualStage \| 'calendar' \| 'review'/)
  for (const stage of ['name-confirmation', 'name-edit', 'username', 'password', 'institution', 'major', 'cohort', 'referral', 'interests']) {
    assert.ok(types.includes("'" + stage + "'"), stage + ' visual stage must exist')
  }
  for (const step of [1, 2, 3, 4]) {
    assert.ok(experience.includes('runCanonicalSave(' + step + ','), 'canonical Step ' + step + ' save must remain present')
  }
  assert.doesNotMatch(experience, /runCanonicalSave\([5-9]/)
  assert.doesNotMatch(experience, /localStorage/)
  assert.match(page, /reviewReturnPath=\{revisionTarget \? '\/onboarding\/review' : null\}/)
})

test('persistent onboarding layout owns one shell across onboarding routes', () => {
  assert.match(onboardingLayout, /<OnboardingShell>\{children\}<\/OnboardingShell>/)
  assert.doesNotMatch(page, /OnboardingShell/)
  assert.doesNotMatch(calendar, /OnboardingShell/)
  assert.doesNotMatch(review, /OnboardingShell/)
  assert.match(page, /<OnboardingRouteStage>/)
  assert.match(calendar, /<OnboardingRouteStage scene="calendar">/)
  assert.match(review, /<OnboardingRouteStage scene="review">/)
})

test('shell uses canonical Strativate brand assets instead of decorative letter branding', () => {
  assert.match(shell, /<BrandLogo variant="mark" \/>/)
  assert.match(shell, /onboarding-ambient__brand/)
  assert.doesNotMatch(shell, /onboarding-ambient__mark/)
  assert.doesNotMatch(shell, />S<\/span>/)
  const welcome = stages.slice(stages.indexOf('export function WelcomeStage'), stages.indexOf('export function NameConfirmationStage'))
  assert.match(welcome, /<BrandLogo variant="mark" priority \/>/)
  assert.doesNotMatch(welcome, /<span \/>/)
})

test('shape grid is subtle, autonomous, and non-interactive', () => {
  assert.match(shell, /<OnboardingShapeGrid \/>/)
  assert.match(shapeGrid, /const GRID_BORDER = '#d7d7d7'/)
  assert.match(shapeGrid, /const GRID_ACCENT = '#ff7a00'/)
  assert.match(shapeGrid, /const GRID_SIZE = 30/)
  assert.match(shapeGrid, /const GRID_SPEED = 0\.3/)
  assert.match(shapeGrid, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(shapeGrid, /mousemove|pointermove|click|hoverTrail/)
  assert.match(css, /\.onboarding-shape-grid \{[\s\S]*pointer-events: none;/)
  assert.match(css, /mask-image: radial-gradient/)
  assert.match(css, /\.onboarding-shape-grid \{ opacity: \.4; \}/)
})

test('autonomous ambient loops are continuous and independent from stage modulation', () => {
  for (const keyframe of [
    'onboarding-ambient-orange',
    'onboarding-ambient-red',
    'onboarding-ambient-ring-one',
    'onboarding-ambient-ring-two',
    'onboarding-ambient-brand',
    'onboarding-ambient-line',
  ]) assert.match(css, new RegExp('@keyframes ' + keyframe))

  assert.match(css, /onboarding-ambient__glow--orange > span[\s\S]*animation: onboarding-ambient-orange 12\.5s/)
  assert.match(css, /onboarding-ambient__glow--red > span[\s\S]*animation: onboarding-ambient-red 15\.8s/)
  assert.match(css, /onboarding-ambient__ring--one > span[\s\S]*animation: onboarding-ambient-ring-one 18s/)
  assert.match(css, /onboarding-ambient__ring--two > span[\s\S]*animation: onboarding-ambient-ring-two 20\.5s/)
  assert.match(css, /onboarding-ambient__brand \.brand-logo[\s\S]*animation: onboarding-ambient-brand 21s/)
  assert.match(css, /onboarding-ambient__line > span[\s\S]*animation: onboarding-ambient-line 16s/)
  assert.match(css, /-2\.4s infinite alternate/)
  assert.match(css, /-6\.1s infinite alternate/)
  assert.match(css, /-9s infinite alternate/)
})

test('micro-stages modulate shell composition through explicit scene ownership', () => {
  assert.match(experience, /setScene\(stage\)/)
  for (const scene of ['welcome', 'name-confirmation', 'username', 'password', 'institution', 'major', 'cohort', 'referral', 'interests', 'calendar', 'review']) {
    assert.ok(css.includes("data-scene='" + scene + "'"), scene + ' scene must have canonical CSS modulation')
  }
  assert.match(shell, /data-scene=\{scene\}/)
  assert.doesNotMatch(css, /:has\(/)
})

test('CSS is consolidated instead of growing another override layer', () => {
  assert.ok(css.split('\n').length < 1200, 'onboarding CSS should remain consolidated')
  assert.doesNotMatch(css, /Final onboarding polish/)
  assert.doesNotMatch(css, /!important/)
  assert.doesNotMatch(css, /:has\(/)
  const names = [...css.matchAll(/@keyframes\s+([^\s{]+)/g)].map(match => match[1])
  assert.equal(new Set(names).size, names.length, 'keyframe names should be unique')
  const baseCss = css.slice(0, css.indexOf('@media (max-width: 640px)'))
  assert.equal((baseCss.match(/\.onboarding-shell\s*\{/g) || []).length, 1)
  assert.equal((baseCss.match(/\.onboarding-answer-card\s*\{/g) || []).length, 1)
})

test('route choreography uses animation lifecycle without fake delay or duplicate navigation authority', () => {
  assert.match(motion, /type RoutePhase = 'idle' \| 'exit' \| 'enter' \| 'final-exit'/)
  assert.match(motion, /navigatingRef/)
  assert.match(motion, /if \(navigatingRef\.current\) return false/)
  assert.match(motion, /onAnimationEnd=/)
  assert.match(motion, /usePageMotionReady/)
  assert.match(motion, /data-motion-ready=\{motionReady \? 'true' : 'false'\}/)
  assert.match(css, /data-motion-ready='true'\]\[data-route-phase='enter'\]/)
  assert.match(motion, /inert=\{routePhase === 'exit' \|\| routePhase === 'final-exit'\}/)
  assert.match(motion, /router\.prefetch\(href\)/)
  assert.doesNotMatch(motion, /setTimeout|sleep\(|minimumDelay|setInterval/)
  assert.doesNotMatch(experience, /setTimeout|sleep\(/)
})

test('reduced motion disables autonomous and transition animations while preserving functionality', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /\.onboarding-ambient__glow > span/)
  assert.match(css, /\.onboarding-ambient__brand \.brand-logo/)
  assert.match(css, /\.onboarding-route-stage/)
  assert.match(css, /animation: none;/)
  assert.match(experience, /if \(reducedMotion\)/)
})

test('list stages avoid parent-child double translate while answer cards own capped stagger', () => {
  assert.match(frame, /interactionMotion = 'wrapper'/)
  assert.match(frame, /data-motion=\{interactionMotion\}/)
  assert.match(stages, /interactionMotion="list"/)
  assert.match(css, /onboarding-question__interaction\[data-motion='wrapper'\]/)
  assert.match(css, /onboarding-question__interaction\[data-motion='list'\] \{ animation: none; \}/)
  assert.match(css, /nth-child\(n\+6\)[^\n]*420ms/)
})

test('referral choice interaction remains direct save with tactile selection state', () => {
  const referralStart = stages.indexOf('export function ReferralStage')
  const interestsStart = stages.indexOf('function interestSummary')
  const referralBlock = stages.slice(referralStart, interestsStart)
  assert.match(referralBlock, /onClick=\{\(\) => onChoose\(option\.id\)\}/)
  assert.match(referralBlock, /aria-pressed=\{active\}/)
  assert.match(referralBlock, /data-has-selection/)
  assert.match(experience, /runCanonicalSave\(3, result\.data as Json\)/)
  assert.match(css, /data-has-selection='true'/)
  assert.match(css, /opacity: \.76/)
})

test('interest selection remains stable multi-select with general completion acknowledgement', () => {
  assert.match(page, /db\.from\('interests'\)[\s\S]*?eq\('is_active', true\)/)
  assert.match(stages, /interests\.map\(/)
  assert.match(stages, /type="checkbox"/)
  assert.match(stages, /Lanjutkan dengan \{selectedIds\.length\} pilihan/)
  assert.match(experience, /Sip, pilihanmu sudah tersimpan\./)
  assert.doesNotMatch(experience, /readableInterestAcknowledgement|selectedInterestNames/)
  assert.doesNotMatch(css, /(^|\n)\s*order\s*:/)
})

test('institution behavior and improved secondary action remain intact', () => {
  assert.match(picker, /rpc\('search_institutions'/)
  assert.match(picker, /rpc\('submit_institution'/)
  assert.match(picker, /exactInstitutionMatches/)
  assert.match(picker, /role="combobox"/)
  assert.match(picker, /role="listbox"/)
  assert.match(picker, /aria-activedescendant/)
  assert.match(picker, /className="institution-create__action"/)
  assert.match(picker, /Ajukan “/)
  assert.match(css, /institution-results button\[aria-selected='true'\]/)
  assert.match(css, /institution-create__action:active/)
})

test('progress resolves intentionally when interests hand off to Calendar', () => {
  assert.match(frame, /role="progressbar"/)
  assert.doesNotMatch(frame, /Langkah|Akun|Institusi|Referensi|Minat/)
  assert.match(css, /data-route-phase='exit'\]\[data-scene='interests'\][\s\S]*onboarding-progress-minimal/)
  assert.match(css, /onboarding-progress-resolve/)
  assert.doesNotMatch(calendar, /OnboardingProgress/)
  assert.doesNotMatch(review, /OnboardingProgress/)
})

test('Calendar remains optional and transitions to review through shared route language', () => {
  assert.match(calendar, /getGoogleConnectionStatus/)
  assert.match(calendar, /Hubungkan Google Calendar/)
  assert.match(calendar, /Lewati, lanjut ke ringkasan/)
  assert.match(calendar, /OnboardingRouteLink/)
  assert.match(calendar, /href="\/onboarding\/review"/)
  assert.doesNotMatch(calendar, /href="\/auth\/continue"/)
})

test('review uses direct section edits, removes duplicate revision menu, and does not overpromise Calendar editing', () => {
  assert.match(review, /Pengecekan akhir/)
  assert.match(review, /Sebelum masuk, periksa sebentar/)
  for (const section of ['identity', 'institution', 'referral', 'interests']) {
    assert.ok(review.includes("reviseHref('" + section + "')"), section + ' direct edit must remain')
  }
  assert.doesNotMatch(review, /Revisi data/)
  assert.doesNotMatch(review, /onboarding-review__revision/)
  assert.doesNotMatch(review, /href="\/onboarding\/calendar"/)
  assert.match(review, /Kelola nanti di dashboard/)
  assert.match(review, /Bisa dihubungkan nanti dari dashboard/)
})

test('review entrance stays staged at a readable pace', () => {
  assert.match(css, /data-motion-ready='true'[\s\S]*onboarding-review__symbol \{ animation: onboarding-review-item 380ms 50ms both; \}/)
  assert.match(css, /onboarding-review__item:nth-child\(5\) \{ animation: onboarding-review-item 380ms 560ms both; \}/)
  assert.match(css, /onboarding-review__actions \{ animation: onboarding-review-item 400ms 640ms both; \}/)
})

test('final CTA has guarded final handoff and still relies on canonical auth continue destination', () => {
  assert.match(review, /href="\/auth\/continue"/)
  assert.match(review, /finalMessage=\{'Semua siap, '/)
  assert.match(shell, /routePhase === 'final-exit'/)
  assert.match(shell, /onboarding-final-handoff/)
  assert.match(motion, /navigatingRef\.current = true/)
  assert.doesNotMatch(motion, /setTimeout|sleep\(/)
})

test('completed mentees can re-save a section without changing normal destination behavior', () => {
  assert.match(page, /account\.mentee\.onboarding_completed_at && params\.revisi === '1'/)
  assert.match(page, /if \(account\.mentee\.onboarding_completed_at && !revisionTarget\) redirect\(account\.destination\)/)
  assert.match(experience, /revisionMode/)
  assert.match(experience, /reviewReturnPath/)
  assert.match(experience, /runCanonicalSave\(1,/)
  assert.match(experience, /runCanonicalSave\(2,/)
  assert.match(experience, /runCanonicalSave\(3,/)
  assert.match(experience, /runCanonicalSave\(4,/)
})

test('onboarding remains responsive, overflow-safe, scoped, and accessible', () => {
  assert.match(rootLayout, /import '\.\/onboarding\.css'/)
  assert.match(css, /@media \(max-width: 640px\)/)
  assert.match(css, /@media \(max-width: 340px\)/)
  assert.match(css, /:focus-visible/)
  assert.doesNotMatch(css, /body\s*\{[^}]*overflow-x:\s*hidden/)
  assert.doesNotMatch(css, /html\s*\{[^}]*overflow-x:\s*hidden/)
  assert.doesNotMatch(css, /height:\s*800px/)
  assert.match(shell, /aria-hidden="true"/)
})
