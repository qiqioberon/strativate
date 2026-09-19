import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const motion = readFileSync('components/animations/react-bits-text.tsx', 'utf8')
const home = readFileSync('components/marketing/home-page.tsx', 'utf8')
const stageFrame = readFileSync('components/onboarding/stage-frame.tsx', 'utf8')
const stages = readFileSync('components/onboarding/stages.tsx', 'utf8')
const calendar = readFileSync('app/onboarding/calendar/page.tsx', 'utf8')
const review = readFileSync('app/onboarding/review/page.tsx', 'utf8')
const commerceCss = readFileSync('app/digital-product-commerce.css', 'utf8')
const heroCss = readFileSync('app/hero-kinetic.css', 'utf8')
const onboardingCss = readFileSync('app/onboarding.css', 'utf8')

test('homepage headline keeps a static setup and cycles equal-level conclusions with Text Type', () => {
  assert.match(home, /Strategi yang kuat dimulai dari/)
  assert.match(home, /cara berpikir yang tajam\./)
  assert.match(home, /analisis yang terarah\./)
  assert.match(home, /keputusan yang matang\./)
  assert.match(home, /ide yang meyakinkan\./)
  assert.match(home, /<TextType/)
  assert.match(motion, /data-react-bits-text="type"/)
  assert.match(motion, /prefers-reduced-motion: reduce/)
  assert.match(heroCss, /\.rb-text-type \{\s*display: inline;\s*\}/)
  assert.doesNotMatch(heroCss, /\.rb-text-type \{[^}]*display: inline-flex;/)
})

test('onboarding headlines use Split Text while supporting copy uses Blur Text', () => {
  assert.match(stageFrame, /<SplitText text=\{title\}/)
  assert.match(stageFrame, /<BlurText text=\{description\}/)
  assert.match(stages, /onboarding-welcome__animated-title/)
  assert.match(stages, /onboarding-welcome__animated-description/)
  assert.match(calendar, /onboarding-calendar-stage__animated-title/)
  assert.match(calendar, /onboarding-calendar-stage__animated-description/)
  assert.match(review, /onboarding-review__animated-title/)
  assert.match(review, /onboarding-review__animated-description/)
  assert.match(motion, /data-react-bits-text="split"/)
  assert.match(motion, /data-react-bits-text="blur"/)
  assert.match(motion, /delay = 56/)
  assert.match(motion, /duration = \.9/)
  assert.match(motion, /startDelay = 0/)
  assert.match(stages, /startDelay=\{\.22\}/)
  assert.match(stages, /startDelay=\{\.48\}/)
  assert.match(onboardingCss, /onboarding-stage-enter 420ms/)
})

test('mobile Card Swap leaves deliberate breathing room below the card for navigation dots', () => {
  assert.match(commerceCss, /@media \(max-width: 560px\)[\s\S]*?digital-product-card-swap__dots \{ bottom: -54px; \}/)
  assert.match(commerceCss, /@media \(max-width: 390px\)[\s\S]*?digital-product-card-swap__dots \{ bottom: -58px; \}/)
})
