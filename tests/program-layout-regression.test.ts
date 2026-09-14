import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('../app/program/page.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../app/program/program-layout-fix.css', import.meta.url), 'utf8')

test('program bento keeps supporting services readable and balanced', () => {
  assert.match(page, /\.\/program-layout-fix\.css/)
  assert.match(css, /marketing-services-supporting\s*\{[\s\S]*display:\s*flex/)
  assert.match(css, /flex:\s*0 1 calc\(\(100% - 24px\) \/ 3\)/)
  assert.match(css, /justify-content:\s*center/)
})

test('primary program cards avoid oversized empty panels and disconnected actions', () => {
  assert.match(css, /marketing-service-card--primary\s*\{[\s\S]*min-height:\s*280px/)
  assert.match(css, /marketing-service-card--primary \.marketing-service-card__action\s*\{[\s\S]*justify-content:\s*flex-start/)
})

test('feature and compact cards keep readable proportions across the bento', () => {
  assert.match(css, /marketing-service-card--secondary\s*\{[\s\S]*min-height:\s*235px/)
  assert.match(css, /marketing-service-card--compact\s*\{[\s\S]*min-height:\s*205px/)
  assert.match(css, /marketing-service-card--compact \.marketing-service-card__copy > p\s*\{[\s\S]*font-size:\s*\.68rem/)
})

test('program hero stays balanced and keeps the motif away from the copy', () => {
  assert.match(css, /marketing-page-intro__grid[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.1fr\)\s+minmax\(360px,\s*\.9fr\)/)
  assert.match(css, /marketing-page-intro h1[\s\S]*font-size:\s*clamp\(3\.55rem,\s*4\.8vw,\s*5\.1rem\)/)
  assert.match(css, /marketing-page-intro__motif[\s\S]*bottom:\s*28px/)
  assert.match(css, /marketing-page-intro__motif[\s\S]*width:\s*min\(18vw,\s*210px\)/)
})

test('program intro and directory do not stack oversized vertical spacing', () => {
  assert.match(css, /marketing-page-intro\s*\{[\s\S]*padding:[^;]+clamp\(46px,\s*4vw,\s*60px\)/)
  assert.match(css, /program-directory\s*\{[\s\S]*padding-top:\s*clamp\(30px,\s*3vw,\s*44px\)/)
})

test('journey connector joins numbered nodes while labels stay below the rail', () => {
  assert.match(css, /program-journey\s*\{[\s\S]*grid-template-columns:\s*1fr/)
  assert.match(css, /program-journey__steps article[\s\S]*grid-template-rows:\s*40px auto/)
  assert.match(css, /program-journey__steps::before[\s\S]*top:\s*20px/)
  assert.match(css, /program-journey__steps article > span[\s\S]*z-index:\s*2/)
})
