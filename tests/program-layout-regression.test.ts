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
